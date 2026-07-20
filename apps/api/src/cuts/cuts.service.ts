import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { assertDateNotClosed } from "../common/backdate";
import { CreateCutDto, UpdateCutDto } from "./dto/cut.dto";

/**
 * Roll → pieces conversion (the CUT inventory event). Rolls are counted as WHOLE
 * ROLLS: one transaction subtracts `rollsUsed` from the roll's warehouse count
 * and adds the produced pieces to warehouse stock. `yardsUsed` is reference-only
 * (folded into the note for costing later), never a stock quantity. Piece cost is
 * deferred to the valuation feature (cost = rolls × cost-per-roll ÷ pieces).
 */
@Injectable()
export class CutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateCutDto, createdById: number) {
    const rolls = dto.rollsUsed ?? 0;
    const outputs = (dto.outputs ?? []).filter((o) => o.qty > 0);
    if (rolls <= 0 && outputs.length === 0) {
      throw new BadRequestException("Enter rolls cut or pieces made");
    }
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
    await assertDateNotClosed(this.prisma, occurredAt ?? null);

    const totalPieces = outputs.reduce((s, o) => s + o.qty, 0);

    return this.prisma.$transaction(async (tx) => {
      // Validate every referenced item type exists; grab each one's current cost.
      const ids = [...new Set([dto.rollItemTypeId, ...outputs.map((o) => o.itemTypeId)])];
      const types = await tx.itemType.findMany({
        where: { id: { in: ids } },
        select: { id: true, key: true, costPrice: true },
      });
      const byId = new Map(types.map((t) => [t.id, t]));
      for (const id of ids) {
        if (!byId.has(id)) throw new BadRequestException(`ItemType ${id} not found`);
      }

      // Warehouse stock BEFORE this cut — for the roll strict-check and to weight
      // the auto-cost moving average. Fetched once.
      const stock = await this.inventory.stockMapAt("WAREHOUSE", tx);
      if (rolls > 0) {
        const have = stock.get(dto.rollItemTypeId) ?? 0;
        if (have < rolls) {
          const t = byId.get(dto.rollItemTypeId);
          throw new ConflictException(
            `Not enough roll stock for ${t?.key ?? `#${dto.rollItemTypeId}`}: have ${have}, need ${rolls}`,
          );
        }
      }

      // Auto-cost: cost per piece = (rolls × roll cost) ÷ pieces, when the roll has
      // a cost set. It rides the IN lines (unitCost) and updates each output item's
      // standard cost to a moving weighted average, so inventory + tailor
      // valuations reflect real production cost with no manual entry. Skipped when
      // the roll is uncosted or nothing was consumed/produced.
      const rollCost = byId.get(dto.rollItemTypeId)?.costPrice ?? null;
      const cutUnitCost =
        rolls > 0 && totalPieces > 0 && rollCost != null
          ? Math.round((rolls * rollCost) / totalPieces)
          : null;

      const lines: {
        direction: "IN" | "OUT";
        location: "WAREHOUSE";
        itemTypeId: number;
        qty: number;
        unitCost?: number;
      }[] = [];
      if (rolls > 0) {
        lines.push({ direction: "OUT", location: "WAREHOUSE", itemTypeId: dto.rollItemTypeId, qty: rolls });
      }
      for (const o of outputs) {
        lines.push({
          direction: "IN",
          location: "WAREHOUSE",
          itemTypeId: o.itemTypeId,
          qty: o.qty,
          ...(cutUnitCost != null ? { unitCost: cutUnitCost } : {}),
        });
      }

      // Yards is reference-only — keep it on the note so it's not lost.
      const yardNote = dto.yardsUsed && dto.yardsUsed > 0 ? `${dto.yardsUsed} yд` : null;
      const notes = [dto.notes?.trim() || null, yardNote].filter(Boolean).join(" · ") || undefined;

      const event = await tx.inventoryEvent.create({
        data: {
          kind: "CUT",
          ...(occurredAt ? { occurredAt } : {}),
          notes,
          createdById,
          lines: { create: lines },
        },
        include: { lines: { include: { itemType: true } } },
      });

      // Blend this cut's cost into each output item's standard cost. Weighted by
      // pre-cut warehouse qty so a stable cost emerges over many cuts (and a
      // one-off cut doesn't wildly swing it). No prior stock/cost → adopt this
      // cut's cost outright. Not reversed on void (cost is a forward-only standard).
      if (cutUnitCost != null) {
        const incomingByType = new Map<number, number>();
        for (const o of outputs) {
          incomingByType.set(o.itemTypeId, (incomingByType.get(o.itemTypeId) ?? 0) + o.qty);
        }
        for (const [itemTypeId, incQty] of incomingByType) {
          const prevQty = Math.max(0, stock.get(itemTypeId) ?? 0);
          const prevCost = byId.get(itemTypeId)?.costPrice ?? 0;
          const newCost =
            prevQty > 0 && prevCost > 0
              ? Math.round((prevQty * prevCost + incQty * cutUnitCost) / (prevQty + incQty))
              : cutUnitCost;
          if (newCost !== prevCost) {
            await tx.itemType.update({ where: { id: itemTypeId }, data: { costPrice: newCost } });
          }
        }
      }

      return event;
    });
  }

  async list(range: { from?: string; to?: string; search?: string } = {}) {
    const search = range.search?.trim();
    return this.prisma.inventoryEvent.findMany({
      where: {
        kind: "CUT",
        voidedAt: null,
        ...(range.from || range.to
          ? {
              occurredAt: {
                ...(range.from ? { gte: new Date(range.from) } : {}),
                ...(range.to ? { lte: new Date(range.to) } : {}),
              },
            }
          : {}),
        ...(search
          ? {
              lines: {
                some: {
                  itemType: {
                    OR: [
                      { labelMy: { contains: search, mode: "insensitive" } },
                      { key: { contains: search, mode: "insensitive" } },
                    ],
                  },
                },
              },
            }
          : {}),
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
      include: {
        lines: { include: { itemType: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    });
  }

  async getOne(id: number) {
    const event = await this.prisma.inventoryEvent.findFirst({
      where: { id, kind: "CUT" },
      include: {
        lines: { include: { itemType: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!event) throw new NotFoundException(`Cut ${id} not found`);
    return event;
  }

  /** Fix a mistake on a cut's date/note (no stock change). */
  async update(id: number, dto: UpdateCutDto) {
    const event = await this.prisma.inventoryEvent.findFirst({ where: { id, kind: "CUT" } });
    if (!event) throw new NotFoundException(`Cut ${id} not found`);
    if (event.voidedAt) throw new BadRequestException("Cannot edit a voided cut");
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
    if (occurredAt) await assertDateNotClosed(this.prisma, occurredAt);
    return this.prisma.inventoryEvent.update({
      where: { id },
      data: {
        ...(occurredAt ? { occurredAt } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { lines: { include: { itemType: true } } },
    });
  }

  /** Undo a cut — soft-voids the event so the roll yards return and the produced
   *  pieces drop out of the ledger. */
  async void(id: number, reason: string | undefined, userId: number) {
    const event = await this.prisma.inventoryEvent.findFirst({ where: { id, kind: "CUT" } });
    if (!event) throw new NotFoundException(`Cut ${id} not found`);
    if (event.voidedAt) throw new ConflictException("Cut is already voided");
    return this.prisma.inventoryEvent.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
  }
}
