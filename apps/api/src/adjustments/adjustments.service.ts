import { BadRequestException, Injectable } from "@nestjs/common";
import type { Location, Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CreateAdjustmentDto } from "./dto/adjustment.dto";

type Tx = Prisma.TransactionClient | PrismaService;

export interface CountInput {
  itemTypeId: number;
  countedQty: number;
}

/**
 * Stock corrections via the ADJUSTMENT InventoryEventKind. This is the single
 * primitive behind both routine cycle counts and resolving stock exceptions:
 * "physical count is truth, true the ledger up to it".
 */
@Injectable()
export class AdjustmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  /**
   * Post an ADJUSTMENT event that trues-up computed stock at `location` to the
   * counted quantities. For each item: delta = counted − computed, recorded as
   * an IN line (delta > 0) or OUT line (delta < 0). Items already matching are
   * skipped. Returns the event, or null if nothing changed (counts already match).
   * Pass `tx` to run inside an existing transaction (e.g. exception resolution).
   */
  async setStock(
    location: Location,
    counts: CountInput[],
    reason: string,
    createdById: number,
    tx: Tx = this.prisma,
  ) {
    if (counts.length === 0) {
      throw new BadRequestException("At least one count is required");
    }
    const ids = [...new Set(counts.map((c) => c.itemTypeId))];
    const types = await tx.itemType.findMany({
      where: { id: { in: ids } },
      select: { id: true, labelMy: true },
    });
    if (types.length !== ids.length) {
      throw new BadRequestException("One or more itemTypeId not found");
    }
    const nameById = new Map(types.map((t) => [t.id, t.labelMy]));

    const current = await this.inventory.stockMapAt(location, tx);
    const lines: {
      direction: "IN" | "OUT";
      location: Location;
      itemTypeId: number;
      qty: number;
    }[] = [];
    // before→after per changed item, so the audit trail can show what it was
    // changed FROM and TO (not just the delta).
    const changes: { itemTypeId: number; name: string; before: number; after: number }[] = [];
    for (const c of counts) {
      const have = current.get(c.itemTypeId) ?? 0;
      const delta = c.countedQty - have;
      if (delta === 0) continue;
      lines.push({
        direction: delta > 0 ? "IN" : "OUT",
        location,
        itemTypeId: c.itemTypeId,
        qty: Math.abs(delta),
      });
      changes.push({
        itemTypeId: c.itemTypeId,
        name: nameById.get(c.itemTypeId) ?? `#${c.itemTypeId}`,
        before: have,
        after: c.countedQty,
      });
    }
    if (lines.length === 0) return null; // counts already match — no-op

    const event = await tx.inventoryEvent.create({
      data: {
        kind: "ADJUSTMENT",
        notes: reason,
        createdById,
        lines: { create: lines },
      },
      include: { lines: { include: { itemType: true } } },
    });
    // `changes` is not persisted — it rides the response so the audit summary can
    // render "item before→after".
    return { ...event, changes };
  }

  /** Top-level entry for the admin stock-count screen. Owns its transaction. */
  async create(dto: CreateAdjustmentDto, createdById: number) {
    return this.prisma.$transaction((tx) =>
      this.setStock(dto.location, dto.counts, dto.reason, createdById, tx),
    );
  }

  /** Recent ADJUSTMENT events for review. */
  async list() {
    return this.prisma.inventoryEvent.findMany({
      where: { kind: "ADJUSTMENT" },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: {
        lines: { include: { itemType: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    });
  }
}
