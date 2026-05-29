import { Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";

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

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
  }): Promise<PageResult<CustomerWithBalance>> {
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
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const balances = await this.balancesFor(rows.map((r) => r.id));
    return {
      data: rows.map((r) => ({ ...r, balance: balances.get(r.id) ?? 0 })),
      page,
      limit,
      total,
    };
  }

  async getOne(id: number): Promise<CustomerWithBalance> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return { ...customer, balance: await this.getBalance(id) };
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

  async getBalance(
    customerId: number,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    const [sales, payments] = await Promise.all([
      tx.sale.aggregate({
        where: { customerId, voidedAt: null },
        _sum: { grandTotal: true },
      }),
      tx.customerPayment.aggregate({
        where: { customerId, voidedAt: null },
        _sum: { amount: true },
      }),
    ]);
    return (sales._sum.grandTotal ?? 0) - (payments._sum.amount ?? 0);
  }

  async balancesFor(
    customerIds: number[],
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<number, number>> {
    if (customerIds.length === 0) return new Map();
    const [sales, payments] = await Promise.all([
      tx.sale.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, voidedAt: null },
        _sum: { grandTotal: true },
      }),
      tx.customerPayment.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, voidedAt: null },
        _sum: { amount: true },
      }),
    ]);
    const map = new Map<number, number>();
    for (const id of customerIds) map.set(id, 0);
    for (const r of sales) map.set(r.customerId, (map.get(r.customerId) ?? 0) + (r._sum.grandTotal ?? 0));
    for (const r of payments) map.set(r.customerId, (map.get(r.customerId) ?? 0) - (r._sum.amount ?? 0));
    return map;
  }
}
