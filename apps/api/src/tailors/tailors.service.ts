import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateTailorDto, UpdateTailorDto } from "./dto/tailor.dto";

export interface TailorWithBalance {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  defaultFeePerPiece: number | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  /**
   * Positive = we owe them (V2: tailor jobs accrue fees).
   * V1: balance is just -sum(payments) since no jobs exist yet, so any payment
   * is recorded as advance/credit on the tailor's side.
   */
  balance: number;
}

@Injectable()
export class TailorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
  }): Promise<PageResult<TailorWithBalance>> {
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
      this.prisma.tailor.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.tailor.count({ where }),
    ]);
    const balances = await this.balancesFor(rows.map((r) => r.id));
    return {
      data: rows.map((r) => ({ ...r, balance: balances.get(r.id) ?? 0 })),
      page,
      limit,
      total,
    };
  }

  async getOne(id: number): Promise<TailorWithBalance> {
    const tailor = await this.prisma.tailor.findUnique({ where: { id } });
    if (!tailor) throw new NotFoundException(`Tailor ${id} not found`);
    return { ...tailor, balance: await this.getBalance(id) };
  }

  async create(dto: CreateTailorDto): Promise<TailorWithBalance> {
    const tailor = await this.prisma.tailor.create({
      data: {
        name: dto.name,
        contact: dto.contact,
        photoUrl: dto.photoUrl,
        defaultFeePerPiece: dto.defaultFeePerPiece,
        notes: dto.notes,
        status: dto.status ?? "ACTIVE",
      },
    });
    return { ...tailor, balance: 0 };
  }

  async update(id: number, dto: UpdateTailorDto): Promise<TailorWithBalance> {
    const existing = await this.prisma.tailor.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Tailor ${id} not found`);
    const tailor = await this.prisma.tailor.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.contact !== undefined ? { contact: dto.contact } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.defaultFeePerPiece !== undefined
          ? { defaultFeePerPiece: dto.defaultFeePerPiece }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return { ...tailor, balance: await this.getBalance(id) };
  }

  async getBalance(tailorId: number): Promise<number> {
    const payments = await this.prisma.tailorPayment.aggregate({
      where: { tailorId, voidedAt: null },
      _sum: { amount: true },
    });
    return -(payments._sum.amount ?? 0);
  }

  async balancesFor(tailorIds: number[]): Promise<Map<number, number>> {
    if (tailorIds.length === 0) return new Map();
    const payments = await this.prisma.tailorPayment.groupBy({
      by: ["tailorId"],
      where: { tailorId: { in: tailorIds }, voidedAt: null },
      _sum: { amount: true },
    });
    const map = new Map<number, number>();
    for (const id of tailorIds) map.set(id, 0);
    for (const r of payments) map.set(r.tailorId, -(r._sum.amount ?? 0));
    return map;
  }
}
