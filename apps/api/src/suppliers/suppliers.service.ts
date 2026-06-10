import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateSupplierDto, UpdateSupplierDto } from "./dto/supplier.dto";

export interface SupplierWithBalance {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** Positive = we owe them. */
  balance: number;
}

type SupplierBalanceRow = {
  supplierId: number;
  balance: number;
};

type SupplierListSqlRow = Omit<SupplierWithBalance, "balance"> & {
  balance: number;
  total: number;
};

/**
 * Supplier balance = sum of receipt grandTotals (receivedQty × unitPrice + transportCost)
 *                  − sum of non-voided supplier payments.
 * Positive = we owe them. Negative = we paid in advance / overpaid.
 */
@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
    inactiveOnly?: boolean;
  }): Promise<PageResult<SupplierWithBalance>> {
    const { page, limit, search, activeOnly = true, inactiveOnly = false } = opts;
    const filters: Prisma.Sql[] = [];
    if (inactiveOnly) filters.push(Prisma.sql`s.status = 'INACTIVE'::"PartyStatus"`);
    else if (activeOnly) filters.push(Prisma.sql`s.status = 'ACTIVE'::"PartyStatus"`);
    if (search) {
      const q = `%${search}%`;
      filters.push(Prisma.sql`(s.name ILIKE ${q} OR COALESCE(s.contact, '') ILIKE ${q})`);
    }
    const whereSql = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SupplierListSqlRow[]>(Prisma.sql`
      WITH filtered AS (
        SELECT s.*
        FROM "Supplier" s
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
      receipts AS (
        SELECT
          o."supplierId",
          SUM(r."goodsCost" + r."transportCost")::int AS total
        FROM "SupplierOrderReceipt" r
        JOIN "SupplierOrder" o ON o.id = r."orderId"
        WHERE o."supplierId" IN (SELECT id FROM page_rows)
          AND r."voidedAt" IS NULL
        GROUP BY o."supplierId"
      ),
      payments AS (
        SELECT "supplierId", SUM(amount)::int AS total
        FROM "SupplierPayment"
        WHERE "supplierId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "supplierId"
      )
      SELECT
        p.id,
        p.name,
        p.contact,
        p."photoUrl",
        p.notes,
        p.status,
        (COALESCE(receipts.total, 0) - COALESCE(payments.total, 0))::int AS balance,
        p.total
      FROM page_rows p
      LEFT JOIN receipts ON receipts."supplierId" = p.id
      LEFT JOIN payments ON payments."supplierId" = p.id
      ORDER BY p.name ASC
    `);

    return {
      data: rows.map(({ total, ...r }) => r),
      page,
      limit,
      total: rows[0]?.total ?? 0,
    };
  }

  async getOne(id: number): Promise<SupplierWithBalance> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id } });
    if (!supplier) throw new NotFoundException(`Supplier ${id} not found`);
    return { ...supplier, balance: await this.getBalance(id) };
  }

  async create(dto: CreateSupplierDto): Promise<SupplierWithBalance> {
    const supplier = await this.prisma.supplier.create({
      data: {
        name: dto.name,
        contact: dto.contact,
        photoUrl: dto.photoUrl,
        notes: dto.notes,
        status: dto.status ?? "ACTIVE",
      },
    });
    return { ...supplier, balance: 0 };
  }

  async update(id: number, dto: UpdateSupplierDto): Promise<SupplierWithBalance> {
    const existing = await this.prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Supplier ${id} not found`);
    const supplier = await this.prisma.supplier.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contact !== undefined ? { contact: dto.contact } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return { ...supplier, balance: await this.getBalance(id) };
  }

  async getBalance(supplierId: number): Promise<number> {
    return (await this.balancesFor([supplierId])).get(supplierId) ?? 0;
  }

  async balancesFor(supplierIds: number[]): Promise<Map<number, number>> {
    if (supplierIds.length === 0) return new Map();
    const map = new Map<number, number>();
    for (const id of supplierIds) map.set(id, 0);

    const idValues = Prisma.join(supplierIds.map((id) => Prisma.sql`(${id})`));
    const rows = await this.prisma.$queryRaw<SupplierBalanceRow[]>(Prisma.sql`
      WITH selected(id) AS (VALUES ${idValues}),
      receipts AS (
        SELECT
          o."supplierId",
          SUM(r."goodsCost" + r."transportCost")::int AS total
        FROM "SupplierOrderReceipt" r
        JOIN "SupplierOrder" o ON o.id = r."orderId"
        WHERE o."supplierId" IN (SELECT id FROM selected)
          AND r."voidedAt" IS NULL
        GROUP BY o."supplierId"
      ),
      payments AS (
        SELECT "supplierId", SUM(amount)::int AS total
        FROM "SupplierPayment"
        WHERE "supplierId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "supplierId"
      )
      SELECT
        selected.id AS "supplierId",
        (COALESCE(receipts.total, 0) - COALESCE(payments.total, 0))::int AS balance
      FROM selected
      LEFT JOIN receipts ON receipts."supplierId" = selected.id
      LEFT JOIN payments ON payments."supplierId" = selected.id
    `);
    for (const r of rows) {
      map.set(r.supplierId, r.balance);
    }
    return map;
  }
}
