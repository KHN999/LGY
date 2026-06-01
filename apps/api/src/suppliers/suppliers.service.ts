import { Injectable, NotFoundException } from "@nestjs/common";
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
  }): Promise<PageResult<SupplierWithBalance>> {
    const { page, limit, search, activeOnly = true } = opts;
    const where = {
      ...(activeOnly ? { status: "ACTIVE" as const } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { contact: { contains: search, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.supplier.count({ where }),
    ]);
    const balances = await this.balancesFor(rows.map((r) => r.id));
    return {
      data: rows.map((r) => ({ ...r, balance: balances.get(r.id) ?? 0 })),
      page,
      limit,
      total,
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
    // Receipt cost = goodsCost + transportCost.
    const receipts = await this.prisma.supplierOrderReceipt.findMany({
      where: { order: { supplierId }, voidedAt: null },
      select: { goodsCost: true, transportCost: true },
    });
    const purchasesTotal = receipts.reduce(
      (s, r) => s + r.goodsCost + r.transportCost,
      0,
    );
    const payments = await this.prisma.supplierPayment.aggregate({
      where: { supplierId, voidedAt: null },
      _sum: { amount: true },
    });
    return purchasesTotal - (payments._sum.amount ?? 0);
  }

  async balancesFor(supplierIds: number[]): Promise<Map<number, number>> {
    if (supplierIds.length === 0) return new Map();
    const receipts = await this.prisma.supplierOrderReceipt.findMany({
      where: { order: { supplierId: { in: supplierIds } }, voidedAt: null },
      select: {
        goodsCost: true,
        transportCost: true,
        order: { select: { supplierId: true } },
      },
    });
    const payments = await this.prisma.supplierPayment.groupBy({
      by: ["supplierId"],
      where: { supplierId: { in: supplierIds }, voidedAt: null },
      _sum: { amount: true },
    });
    const map = new Map<number, number>();
    for (const id of supplierIds) map.set(id, 0);
    for (const r of receipts) {
      const sid = r.order.supplierId;
      map.set(sid, (map.get(sid) ?? 0) + r.goodsCost + r.transportCost);
    }
    for (const r of payments) {
      map.set(r.supplierId, (map.get(r.supplierId) ?? 0) - (r._sum.amount ?? 0));
    }
    return map;
  }
}
