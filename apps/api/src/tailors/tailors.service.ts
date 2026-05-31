import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { TailorCharge, TailorPayment } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import {
  CreateTailorDto,
  UpdateTailorDto,
  CreateTailorChargeDto,
  UpdateTailorChargeDto,
  CreateTailorPaymentDto,
} from "./dto/tailor.dto";

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

export interface TailorDetail extends TailorWithBalance {
  charges: TailorCharge[];
  payments: TailorPayment[];
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

  async getOne(id: number): Promise<TailorDetail> {
    const tailor = await this.prisma.tailor.findUnique({ where: { id } });
    if (!tailor) throw new NotFoundException(`Tailor ${id} not found`);
    const [charges, payments] = await Promise.all([
      this.prisma.tailorCharge.findMany({
        where: { tailorId: id, voidedAt: null },
        orderBy: { chargeDate: "desc" },
      }),
      this.prisma.tailorPayment.findMany({
        where: { tailorId: id, voidedAt: null },
        orderBy: { paymentDate: "desc" },
      }),
    ]);
    const balance =
      charges.reduce((s, c) => s + c.amount, 0) - payments.reduce((s, p) => s + p.amount, 0);
    return { ...tailor, balance, charges, payments };
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

  /** Positive = we owe the tailor: Σ charges − Σ payments (non-voided). */
  async getBalance(tailorId: number): Promise<number> {
    const [charges, payments] = await Promise.all([
      this.prisma.tailorCharge.aggregate({
        where: { tailorId, voidedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.tailorPayment.aggregate({
        where: { tailorId, voidedAt: null },
        _sum: { amount: true },
      }),
    ]);
    return (charges._sum.amount ?? 0) - (payments._sum.amount ?? 0);
  }

  async balancesFor(tailorIds: number[]): Promise<Map<number, number>> {
    if (tailorIds.length === 0) return new Map();
    const [charges, payments] = await Promise.all([
      this.prisma.tailorCharge.groupBy({
        by: ["tailorId"],
        where: { tailorId: { in: tailorIds }, voidedAt: null },
        _sum: { amount: true },
      }),
      this.prisma.tailorPayment.groupBy({
        by: ["tailorId"],
        where: { tailorId: { in: tailorIds }, voidedAt: null },
        _sum: { amount: true },
      }),
    ]);
    const map = new Map<number, number>();
    for (const id of tailorIds) map.set(id, 0);
    for (const r of charges) map.set(r.tailorId, (map.get(r.tailorId) ?? 0) + (r._sum.amount ?? 0));
    for (const r of payments) map.set(r.tailorId, (map.get(r.tailorId) ?? 0) - (r._sum.amount ?? 0));
    return map;
  }

  // ── Charges (fees owed to the tailor) ─────────────────────────────
  private async ensureTailor(id: number) {
    const t = await this.prisma.tailor.findUnique({ where: { id }, select: { id: true } });
    if (!t) throw new NotFoundException(`Tailor ${id} not found`);
  }

  async createCharge(tailorId: number, dto: CreateTailorChargeDto, userId: number) {
    await this.ensureTailor(tailorId);
    return this.prisma.tailorCharge.create({
      data: {
        tailorId,
        amount: dto.amount,
        pieces: dto.pieces ?? null,
        feePerPiece: dto.feePerPiece ?? null,
        note: dto.note,
        createdById: userId,
      },
    });
  }

  async updateCharge(chargeId: number, dto: UpdateTailorChargeDto) {
    const c = await this.prisma.tailorCharge.findUnique({ where: { id: chargeId } });
    if (!c) throw new NotFoundException(`Charge ${chargeId} not found`);
    if (c.voidedAt) throw new BadRequestException("Cannot edit a voided charge");
    return this.prisma.tailorCharge.update({
      where: { id: chargeId },
      data: {
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.pieces !== undefined ? { pieces: dto.pieces } : {}),
        ...(dto.feePerPiece !== undefined ? { feePerPiece: dto.feePerPiece } : {}),
        ...(dto.note !== undefined ? { note: dto.note } : {}),
      },
    });
  }

  async voidCharge(chargeId: number, reason: string | undefined, userId: number) {
    const c = await this.prisma.tailorCharge.findUnique({ where: { id: chargeId } });
    if (!c) throw new NotFoundException(`Charge ${chargeId} not found`);
    if (c.voidedAt) return c;
    return this.prisma.tailorCharge.update({
      where: { id: chargeId },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
  }

  // ── Payments (money paid to the tailor) ───────────────────────────
  async createPayment(tailorId: number, dto: CreateTailorPaymentDto, userId: number) {
    await this.ensureTailor(tailorId);
    return this.prisma.tailorPayment.create({
      data: {
        tailorId,
        amount: dto.amount,
        method: dto.method ?? "CASH",
        notes: dto.notes,
        createdById: userId,
      },
    });
  }

  async voidPayment(paymentId: number, reason: string | undefined, userId: number) {
    const p = await this.prisma.tailorPayment.findUnique({ where: { id: paymentId } });
    if (!p) throw new NotFoundException(`Payment ${paymentId} not found`);
    if (p.voidedAt) return p;
    return this.prisma.tailorPayment.update({
      where: { id: paymentId },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
  }
}
