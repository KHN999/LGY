import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { ImportCustomersDto } from "./dto/import-customers.dto";
import { normalizeName, nameKey } from "../common/name";

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
    if (search && search.trim()) {
      // Match on a normalized name (NFC + lowercase + separators stripped) so a
      // name typed in either Burmese byte-form still matches — the fix for staff
      // not finding an existing customer and creating a duplicate. Also match on
      // digits-only contact when the query looks like a phone number.
      const key = nameKey(search);
      const nameClauses: Prisma.Sql[] = [];
      if (key) {
        const q = `%${key.replace(/[%\\]/g, (m) => "\\" + m)}%`;
        nameClauses.push(
          Prisma.sql`regexp_replace(lower(normalize(c.name, NFC)), '[[:space:]._-]', '', 'g') LIKE ${q}`,
        );
      }
      const digits = search.replace(/\D/g, "");
      if (digits.length >= 3) {
        nameClauses.push(
          Prisma.sql`regexp_replace(COALESCE(c.contact, ''), '[^0-9]', '', 'g') LIKE ${`%${digits}%`}`,
        );
      }
      if (nameClauses.length) filters.push(Prisma.sql`(${Prisma.join(nameClauses, " OR ")})`);
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
    const cleanName = normalizeName(name);
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
      : all.find((c) => nameKey(c.name) === nameKey(cleanName));

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
        name: normalizeName(dto.name),
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
    const seenNames = new Set(existing.map((c) => nameKey(c.name)));

    const toCreate: { name: string; contact: string | null }[] = [];
    let skipped = 0;
    for (const c of dto.contacts) {
      const name = normalizeName(c.name);
      const phone = digits(c.contact);
      if (!name) {
        skipped++;
        continue;
      }
      const key = nameKey(name);
      const dup = phone ? seenPhones.has(phone) : seenNames.has(key);
      if (dup) {
        skipped++;
        continue;
      }
      if (phone) seenPhones.add(phone);
      else seenNames.add(key);
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
        ...(dto.name !== undefined ? { name: normalizeName(dto.name) } : {}),
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

  /**
   * Find non-deleted customers whose name matches `name` after stripping case,
   * spaces and punctuation — so "B-204", "B 204" and "B204" all collide. Used to
   * warn at creation time and to suggest merge candidates. Empty for <2 chars.
   */
  async similar(
    name: string,
    excludeId?: number,
  ): Promise<{ id: number; name: string; contact: string | null }[]> {
    // NFC + lowercase + strip separators, so "B-204"/"B 204"/"B204" collapse to
    // "b204" AND both Burmese byte-forms of a name collapse together — Burmese
    // letters/digits are preserved (a "keep only a-z0-9" rule would erase them).
    const norm = nameKey(name);
    if (norm.length < 2) return [];
    // Escape LIKE metacharacters that could survive normalization.
    const like = `%${norm.replace(/[%\\]/g, (m) => "\\" + m)}%`;
    const rows = await this.prisma.$queryRaw<
      { id: number; name: string; contact: string | null }[]
    >(Prisma.sql`
      SELECT id, name, contact
      FROM "Customer"
      WHERE "deletedAt" IS NULL
        AND regexp_replace(lower(normalize(name, NFC)), '[[:space:]._-]', '', 'g') LIKE ${like}
        ${excludeId ? Prisma.sql`AND id <> ${excludeId}` : Prisma.empty}
      ORDER BY name ASC
      LIMIT 8
    `);
    return rows.map((r) => ({ id: Number(r.id), name: r.name, contact: r.contact }));
  }

  /**
   * Merge duplicate customers INTO `survivorId`: repoint every record they own
   * (sales, payments, returns) onto the survivor, then soft-delete the emptied
   * duplicates. Debt is NOT written off here (unlike softDelete) — their ledger
   * moved to the survivor, so the survivor's balance recomputes to include it and
   * the duplicates carry nothing. Returns the survivor (with fresh balance) plus
   * merge metadata for the audit log.
   */
  async merge(
    survivorId: number,
    sourceIdsRaw: number[],
  ): Promise<CustomerWithBalance & { mergedCount: number; mergedNames: string[] }> {
    const survivor = await this.prisma.customer.findUnique({ where: { id: survivorId } });
    if (!survivor) throw new NotFoundException(`Customer ${survivorId} not found`);
    if (survivor.deletedAt) throw new BadRequestException("Cannot merge into a deleted customer");

    const ids = [...new Set(sourceIdsRaw)].filter((id) => id !== survivorId);
    if (ids.length === 0) {
      throw new BadRequestException("Pick at least one other customer to merge in");
    }
    const sources = await this.prisma.customer.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, contact: true, notes: true },
    });
    if (sources.length === 0) throw new BadRequestException("No valid customers to merge");
    const sourceIds = sources.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      const where = { customerId: { in: sourceIds } };
      await tx.sale.updateMany({ where, data: { customerId: survivorId } });
      await tx.customerPayment.updateMany({ where, data: { customerId: survivorId } });
      await tx.saleReturn.updateMany({ where, data: { customerId: survivorId } });

      // Backfill a missing contact/notes on the survivor from a duplicate.
      const fill: { contact?: string; notes?: string } = {};
      if (!survivor.contact) {
        const c = sources.find((s) => s.contact?.trim())?.contact;
        if (c) fill.contact = c;
      }
      if (!survivor.notes) {
        const n = sources.find((s) => s.notes?.trim())?.notes;
        if (n) fill.notes = n;
      }
      if (Object.keys(fill).length > 0) {
        await tx.customer.update({ where: { id: survivorId }, data: fill });
      }

      await tx.customer.updateMany({
        where: { id: { in: sourceIds } },
        data: { deletedAt: new Date(), status: "INACTIVE" },
      });
    });

    const updated = await this.getOne(survivorId);
    return { ...updated, mergedCount: sources.length, mergedNames: sources.map((s) => s.name) };
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
