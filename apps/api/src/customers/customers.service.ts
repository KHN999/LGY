import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { ImportCustomersDto } from "./dto/import-customers.dto";

export interface CustomerWithBalance {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  defaultKind: "WHOLESALE" | "RETAIL";
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** Outstanding debt: positive = customer owes us. */
  balance: number;
}

type CustomerBalanceRow = {
  customerId: number;
  balance: number;
};

type CustomerListSqlRow = Omit<CustomerWithBalance, "balance"> & {
  balance: number;
  total: number;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
    inactiveOnly?: boolean;
  }): Promise<PageResult<CustomerWithBalance>> {
    const { page, limit, search, activeOnly = true, inactiveOnly = false } = opts;
    // Deleted customers are written off — never shown in any list.
    const filters: Prisma.Sql[] = [Prisma.sql`c."deletedAt" IS NULL`];
    if (inactiveOnly) filters.push(Prisma.sql`c.status = 'INACTIVE'::"PartyStatus"`);
    else if (activeOnly) filters.push(Prisma.sql`c.status = 'ACTIVE'::"PartyStatus"`);
    if (search) {
      const q = `%${search}%`;
      filters.push(Prisma.sql`(c.name ILIKE ${q} OR COALESCE(c.contact, '') ILIKE ${q})`);
    }
    const whereSql = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<CustomerListSqlRow[]>(Prisma.sql`
      WITH filtered AS (
        SELECT c.*
        FROM "Customer" c
        ${whereSql}
      ),
      page_rows AS (
        SELECT
          filtered.*,
          COUNT(*) OVER()::int AS total
        FROM filtered
        ORDER BY name ASC
        OFFSET ${(page - 1) * limit}
        LIMIT ${limit}
      ),
      sales AS (
        SELECT "customerId", SUM("grandTotal")::int AS total
        FROM "Sale"
        WHERE "customerId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      payments AS (
        SELECT "customerId", SUM(amount)::int AS total
        FROM "CustomerPayment"
        WHERE "customerId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      returns AS (
        SELECT
          "customerId",
          SUM("returnTotal")::int AS return_total,
          SUM("refundAmount")::int AS refund_total
        FROM "SaleReturn"
        WHERE "customerId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      )
      SELECT
        p.id,
        p.name,
        p.contact,
        p."photoUrl",
        p."defaultKind",
        p.notes,
        p.status,
        (
          COALESCE(sales.total, 0)
          - COALESCE(returns.return_total, 0)
          - COALESCE(payments.total, 0)
          + COALESCE(returns.refund_total, 0)
        )::int AS balance,
        p.total
      FROM page_rows p
      LEFT JOIN sales ON sales."customerId" = p.id
      LEFT JOIN payments ON payments."customerId" = p.id
      LEFT JOIN returns ON returns."customerId" = p.id
      ORDER BY p.name ASC
    `);

    return {
      data: rows.map(({ total, ...r }) => r),
      page,
      limit,
      total: rows[0]?.total ?? 0,
    };
  }

  async getOne(id: number): Promise<CustomerWithBalance> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return { ...customer, balance: await this.getBalance(id) };
  }

  /**
   * Find an existing customer by phone (digits) — or by name when there's no
   * phone — else create one. For the staff sell flow's "import from phone",
   * which must work for non-admins (POST /customers is admin-only). Dedupes so
   * repeatedly importing the same contact doesn't pile up duplicates.
   */
  async findOrCreateFromContact(name: string, contact?: string): Promise<CustomerWithBalance> {
    const cleanName = name.trim();
    if (!cleanName) throw new BadRequestException("Contact name is required");
    const cleanContact = contact?.trim() || null;
    const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
    const phone = digits(cleanContact);

    const all = await this.prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, contact: true },
    });
    const match = phone
      ? all.find((c) => digits(c.contact) === phone)
      : all.find((c) => c.name.trim().toLowerCase() === cleanName.toLowerCase());

    if (match) {
      const existing = await this.prisma.customer.findUnique({ where: { id: match.id } });
      return { ...existing!, balance: await this.getBalance(match.id) };
    }

    const created = await this.prisma.customer.create({
      data: { name: cleanName, contact: cleanContact, defaultKind: "WHOLESALE", status: "ACTIVE" },
    });
    return { ...created, balance: 0 };
  }

  async create(dto: CreateCustomerDto): Promise<CustomerWithBalance> {
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        contact: dto.contact,
        photoUrl: dto.photoUrl,
        defaultKind: dto.defaultKind ?? "WHOLESALE",
        notes: dto.notes,
        status: dto.status ?? "ACTIVE",
      },
    });
    return { ...customer, balance: 0 };
  }

  /** Bulk-create customers from picked phone contacts. Skips anyone whose phone
   *  already exists (or whose name already exists when they have no phone), and
   *  de-dupes within the batch too. One createMany round-trip. */
  async importContacts(dto: ImportCustomersDto): Promise<{ created: number; skipped: number }> {
    const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

    const existing = await this.prisma.customer.findMany({ select: { name: true, contact: true } });
    const seenPhones = new Set(existing.map((c) => digits(c.contact)).filter(Boolean));
    const seenNames = new Set(existing.map((c) => c.name.trim().toLowerCase()));

    const toCreate: { name: string; contact: string | null }[] = [];
    let skipped = 0;
    for (const c of dto.contacts) {
      const name = c.name.trim();
      const phone = digits(c.contact);
      if (!name) {
        skipped++;
        continue;
      }
      const dup = phone ? seenPhones.has(phone) : seenNames.has(name.toLowerCase());
      if (dup) {
        skipped++;
        continue;
      }
      if (phone) seenPhones.add(phone);
      else seenNames.add(name.toLowerCase());
      toCreate.push({ name, contact: c.contact?.trim() || null });
    }

    if (toCreate.length > 0) {
      await this.prisma.customer.createMany({ data: toCreate });
    }
    return { created: toCreate.length, skipped };
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<CustomerWithBalance> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Customer ${id} not found`);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contact !== undefined ? { contact: dto.contact } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.defaultKind !== undefined ? { defaultKind: dto.defaultKind } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return { ...customer, balance: await this.getBalance(id) };
  }

  /**
   * Soft-delete a customer and write off any outstanding debt: sets deletedAt so
   * they drop out of every list/picker and the debt totals, while their past
   * sales/payments stay intact. Returns the name + the balance that was cleared
   * (for the audit log). Idempotent — re-deleting clears nothing more.
   */
  async softDelete(id: number): Promise<{ id: number; name: string; clearedDebt: number }> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    if (customer.deletedAt) return { id: customer.id, name: customer.name, clearedDebt: 0 };
    const clearedDebt = Math.max(0, await this.getBalance(id));
    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id: customer.id, name: customer.name, clearedDebt };
  }

  async getBalance(
    customerId: number,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    return (await this.balancesFor([customerId], tx)).get(customerId) ?? 0;
  }

  async balancesFor(
    customerIds: number[],
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<number, number>> {
    if (customerIds.length === 0) return new Map();
    const map = new Map<number, number>();
    for (const id of customerIds) map.set(id, 0);

    const idValues = Prisma.join(customerIds.map((id) => Prisma.sql`(${id})`));
    const rows = await tx.$queryRaw<CustomerBalanceRow[]>(Prisma.sql`
      WITH selected(id) AS (VALUES ${idValues}),
      sales AS (
        SELECT "customerId", SUM("grandTotal")::int AS total
        FROM "Sale"
        WHERE "customerId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      payments AS (
        SELECT "customerId", SUM(amount)::int AS total
        FROM "CustomerPayment"
        WHERE "customerId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      returns AS (
        SELECT
          "customerId",
          SUM("returnTotal")::int AS return_total,
          SUM("refundAmount")::int AS refund_total
        FROM "SaleReturn"
        WHERE "customerId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      )
      SELECT
        selected.id AS "customerId",
        (
          COALESCE(sales.total, 0)
          - COALESCE(returns.return_total, 0)
          - COALESCE(payments.total, 0)
          + COALESCE(returns.refund_total, 0)
        )::int AS balance
      FROM selected
      LEFT JOIN sales ON sales."customerId" = selected.id
      LEFT JOIN payments ON payments."customerId" = selected.id
      LEFT JOIN returns ON returns."customerId" = selected.id
    `);
    for (const r of rows) {
      // $queryRaw returns the VALUES id as a BigInt; the map is looked up with a
      // Number in getBalance, so coerce or the lookup misses and returns 0.
      map.set(Number(r.customerId), Number(r.balance));
    }
    return map;
  }
}
