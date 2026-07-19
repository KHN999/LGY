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
  SendToTailorDto,
  ReceiveFromTailorDto,
  UpdateTailorJobDto,
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

export interface TailorHolding {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  qty: number;
}

export interface TailorDetail extends TailorWithBalance {
  charges: TailorCharge[];
  payments: TailorPayment[];
  holdings: TailorHolding[];
}

@Injectable()
export class TailorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
    inactiveOnly?: boolean;
  }): Promise<PageResult<TailorWithBalance>> {
    const { page, limit, search, activeOnly = true, inactiveOnly = false } = opts;
    const where = {
      ...(inactiveOnly
        ? { status: "INACTIVE" as const }
        : activeOnly
          ? { status: "ACTIVE" as const }
          : {}),
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
    const [charges, payments, holdings] = await Promise.all([
      this.prisma.tailorCharge.findMany({
        where: { tailorId: id, voidedAt: null },
        orderBy: { chargeDate: "desc" },
      }),
      this.prisma.tailorPayment.findMany({
        where: { tailorId: id, voidedAt: null },
        orderBy: { paymentDate: "desc" },
      }),
      this.getHoldings(id),
    ]);
    const balance =
      charges.reduce((s, c) => s + c.amount, 0) - payments.reduce((s, p) => s + p.amount, 0);
    return { ...tailor, balance, charges, payments, holdings };
  }

  /** Stock currently in the tailor's hands (Σ IN − OUT at location=TAILOR). */
  async getHoldings(tailorId: number): Promise<TailorHolding[]> {
    const lines = await this.prisma.inventoryLine.findMany({
      where: { tailorId, location: "TAILOR", event: { voidedAt: null } },
      include: { itemType: { select: { id: true, key: true, labelMy: true, emoji: true } } },
    });
    const map = new Map<number, TailorHolding>();
    for (const l of lines) {
      const t = l.itemType;
      const cur =
        map.get(t.id) ?? { itemTypeId: t.id, key: t.key, labelMy: t.labelMy, emoji: t.emoji, qty: 0 };
      cur.qty += l.direction === "IN" ? l.qty : -l.qty;
      map.set(t.id, cur);
    }
    return [...map.values()].filter((h) => h.qty !== 0);
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

  // ── Production: send goods to a tailor / receive them back ─────────
  async sendToTailor(tailorId: number, dto: SendToTailorDto, userId: number) {
    await this.ensureTailor(tailorId);
    return this.prisma.$transaction(async (tx) => {
      const requested = new Map<number, number>();
      for (const it of dto.items) requested.set(it.itemTypeId, (requested.get(it.itemTypeId) ?? 0) + it.qty);

      // Validate warehouse has enough.
      const stockLines = await tx.inventoryLine.findMany({
        where: { location: "WAREHOUSE", itemTypeId: { in: [...requested.keys()] }, event: { voidedAt: null } },
        select: { itemTypeId: true, direction: true, qty: true },
      });
      const stock = new Map<number, number>();
      for (const l of stockLines) {
        stock.set(l.itemTypeId, (stock.get(l.itemTypeId) ?? 0) + (l.direction === "IN" ? l.qty : -l.qty));
      }
      for (const [id, qty] of requested) {
        if ((stock.get(id) ?? 0) < qty) {
          throw new BadRequestException(`Not enough warehouse stock for item #${id}`);
        }
      }

      const lines = dto.items.flatMap((it) => [
        { direction: "OUT" as const, location: "WAREHOUSE" as const, itemTypeId: it.itemTypeId, qty: it.qty },
        { direction: "IN" as const, location: "TAILOR" as const, tailorId, itemTypeId: it.itemTypeId, qty: it.qty },
      ]);
      return tx.inventoryEvent.create({
        data: {
          kind: "TAILOR_SEND",
          notes: dto.notes,
          createdById: userId,
          ...(dto.occurredAt ? { occurredAt: new Date(dto.occurredAt) } : {}),
          lines: { create: lines },
        },
        include: { lines: { include: { itemType: true } } },
      });
    });
  }

  async receiveFromTailor(tailorId: number, dto: ReceiveFromTailorDto, userId: number) {
    const tailor = await this.prisma.tailor.findUnique({ where: { id: tailorId } });
    if (!tailor) throw new NotFoundException(`Tailor ${tailorId} not found`);
    for (const l of dto.lines) {
      if (l.receivedQty > l.sentQty) {
        throw new BadRequestException("Received quantity cannot exceed sent quantity");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      // Validate the tailor actually holds what's being returned.
      const holdLines = await tx.inventoryLine.findMany({
        where: { tailorId, location: "TAILOR", event: { voidedAt: null } },
        select: { itemTypeId: true, direction: true, qty: true },
      });
      const hold = new Map<number, number>();
      for (const l of holdLines) {
        hold.set(l.itemTypeId, (hold.get(l.itemTypeId) ?? 0) + (l.direction === "IN" ? l.qty : -l.qty));
      }
      const needed = new Map<number, number>();
      for (const l of dto.lines) needed.set(l.inputItemTypeId, (needed.get(l.inputItemTypeId) ?? 0) + l.sentQty);
      for (const [id, qty] of needed) {
        if ((hold.get(id) ?? 0) < qty) {
          throw new BadRequestException(`Tailor doesn't hold enough of item #${id}`);
        }
      }

      // The successful transform: the good input pieces are consumed and the
      // finished output goes to the warehouse (input qty == output qty).
      const returnLines = dto.lines.flatMap((l) =>
        l.receivedQty > 0
          ? [
              { direction: "OUT" as const, location: "TAILOR" as const, tailorId, itemTypeId: l.inputItemTypeId, qty: l.receivedQty },
              { direction: "IN" as const, location: "WAREHOUSE" as const, itemTypeId: l.outputItemTypeId, qty: l.receivedQty },
            ]
          : [],
      );
      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
      const event = await tx.inventoryEvent.create({
        data: {
          kind: "TAILOR_RETURN",
          notes: dto.notes,
          createdById: userId,
          ...(occurredAt ? { occurredAt } : {}),
          lines: { create: returnLines },
        },
        include: { lines: { include: { itemType: true } } },
      });

      // Spoilage: input pieces that didn't survive sewing leave the tailor as a
      // LOSS event (so it's an auditable kind=LOSS ledger entry, not silently
      // dropped). Linked to the return so the slip can still show full sent qty.
      const lossLines = dto.lines.flatMap((l) => {
        const lost = l.sentQty - l.receivedQty;
        return lost > 0
          ? [{ direction: "OUT" as const, location: "TAILOR" as const, tailorId, itemTypeId: l.inputItemTypeId, qty: lost }]
          : [];
      });
      if (lossLines.length > 0) {
        await tx.inventoryEvent.create({
          data: {
            kind: "LOSS",
            relatedEventId: event.id,
            notes: `Sewing loss · tailor #${tailorId}`,
            createdById: userId,
            ...(occurredAt ? { occurredAt } : {}),
            lines: { create: lossLines },
          },
        });
      }

      // Auto-charge the sewing fee to the tailor's ledger.
      if (dto.fee && dto.fee > 0) {
        const pieces = dto.lines.reduce((s, l) => s + l.receivedQty, 0);
        await tx.tailorCharge.create({
          data: {
            tailorId,
            amount: dto.fee,
            pieces,
            feePerPiece: tailor.defaultFeePerPiece ?? null,
            eventId: event.id,
            note: `Sewing return #${event.id}`,
            createdById: userId,
            ...(occurredAt ? { chargeDate: occurredAt } : {}),
          },
        });
      }

      return event;
    });
  }

  // ── Tailor job history (send/receive events) ──────────────────────
  private readonly jobInclude = {
    lines: { include: { itemType: true } },
    tailorCharges: { where: { voidedAt: null } },
    createdBy: { select: { id: true, username: true, displayName: true } },
    // Linked LOSS events (sewing spoilage) so the slip can show full sent qty.
    derivedEvents: {
      where: { voidedAt: null },
      include: { lines: { include: { itemType: true } } },
    },
  };

  async getJobs(tailorId: number) {
    return this.prisma.inventoryEvent.findMany({
      where: { kind: { in: ["TAILOR_SEND", "TAILOR_RETURN"] }, lines: { some: { tailorId } } },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: this.jobInclude,
    });
  }

  async getJob(eventId: number) {
    const event = await this.prisma.inventoryEvent.findFirst({
      where: { id: eventId, kind: { in: ["TAILOR_SEND", "TAILOR_RETURN"] } },
      include: this.jobInclude,
    });
    if (!event) throw new NotFoundException(`Tailor job ${eventId} not found`);
    return event;
  }

  /** Fix a mistake on a tailor job's date/note (no stock or fee change). */
  async updateJob(eventId: number, dto: UpdateTailorJobDto) {
    const event = await this.prisma.inventoryEvent.findFirst({
      where: { id: eventId, kind: { in: ["TAILOR_SEND", "TAILOR_RETURN"] } },
    });
    if (!event) throw new NotFoundException(`Tailor job ${eventId} not found`);
    if (event.voidedAt) throw new BadRequestException("Cannot edit a voided job");
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
    await this.prisma.inventoryEvent.update({
      where: { id: eventId },
      data: {
        ...(occurredAt ? { occurredAt } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
    // Keep the linked sewing-fee charge's date aligned with a re-dated return.
    if (occurredAt && event.kind === "TAILOR_RETURN") {
      await this.prisma.tailorCharge.updateMany({
        where: { eventId, voidedAt: null },
        data: { chargeDate: occurredAt },
      });
    }
    return this.getJob(eventId);
  }

  /**
   * Undo a tailor job. Soft-voids the InventoryEvent (its lines drop out of the
   * ledger, reverting stock). For a RETURN, also voids the auto-charged sewing
   * fee and any linked spoilage LOSS event so nothing is left dangling.
   */
  async voidJob(eventId: number, reason: string | undefined, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.inventoryEvent.findFirst({
        where: { id: eventId, kind: { in: ["TAILOR_SEND", "TAILOR_RETURN"] } },
      });
      if (!event) throw new NotFoundException(`Tailor job ${eventId} not found`);
      if (event.voidedAt) return event;
      const stamp = { voidedAt: new Date(), voidedById: userId, voidReason: reason };
      const voided = await tx.inventoryEvent.update({ where: { id: eventId }, data: stamp });
      if (event.kind === "TAILOR_RETURN") {
        // Reverse the sewing-fee charge(s) and the spoilage LOSS this return posted.
        await tx.tailorCharge.updateMany({ where: { eventId, voidedAt: null }, data: stamp });
        await tx.inventoryEvent.updateMany({
          where: { relatedEventId: eventId, kind: "LOSS", voidedAt: null },
          data: stamp,
        });
      }
      return voided;
    });
  }
}
