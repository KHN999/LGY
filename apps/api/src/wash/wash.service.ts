import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { assertDateNotClosed } from "../common/backdate";
import { CreateWashDto, UpdateWashDto } from "./dto/wash.dto";

/**
 * Piece → washed-piece conversion (the WASH inventory event). Each line consumes
 * `qty` of an input piece from the warehouse and produces `qty` of a washed
 * output category back into the warehouse (1:1). The washed piece inherits the
 * input's cost (moving weighted average), so inventory value flows through the
 * wash stage. Mirrors the CUT service.
 */
@Injectable()
export class WashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateWashDto, createdById: number) {
    const inputLines = dto.lines.filter((l) => l.qty > 0);
    if (inputLines.length === 0) throw new BadRequestException("Enter what was washed");
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
    await assertDateNotClosed(this.prisma, occurredAt ?? null);

    return this.prisma.$transaction(async (tx) => {
      const ids = [
        ...new Set(inputLines.flatMap((l) => [l.inputItemTypeId, l.outputItemTypeId])),
      ];
      const types = await tx.itemType.findMany({
        where: { id: { in: ids } },
        select: { id: true, key: true, costPrice: true },
      });
      const byId = new Map(types.map((t) => [t.id, t]));
      for (const id of ids) {
        if (!byId.has(id)) throw new BadRequestException(`ItemType ${id} not found`);
      }

      // Warehouse is strict on the inputs. Aggregate the draw per input item.
      const stock = await this.inventory.stockMapAt("WAREHOUSE", tx);
      const inputDraw = new Map<number, number>();
      for (const l of inputLines) {
        inputDraw.set(l.inputItemTypeId, (inputDraw.get(l.inputItemTypeId) ?? 0) + l.qty);
      }
      for (const [id, qty] of inputDraw) {
        const have = stock.get(id) ?? 0;
        if (have < qty) {
          const t = byId.get(id);
          throw new ConflictException(
            `Not enough stock for ${t?.key ?? `#${id}`}: have ${have}, need ${qty}`,
          );
        }
      }

      // Build lines + track incoming cost per output for the moving average.
      const lines: {
        direction: "IN" | "OUT";
        location: "WAREHOUSE";
        itemTypeId: number;
        qty: number;
        unitCost?: number;
      }[] = [];
      // outputId → { qty, value, allCosted }
      const incoming = new Map<number, { qty: number; value: number; allCosted: boolean }>();
      for (const l of inputLines) {
        const inputCost = byId.get(l.inputItemTypeId)?.costPrice ?? null;
        lines.push({ direction: "OUT", location: "WAREHOUSE", itemTypeId: l.inputItemTypeId, qty: l.qty });
        lines.push({
          direction: "IN",
          location: "WAREHOUSE",
          itemTypeId: l.outputItemTypeId,
          qty: l.qty,
          ...(inputCost != null ? { unitCost: inputCost } : {}),
        });
        const cur = incoming.get(l.outputItemTypeId) ?? { qty: 0, value: 0, allCosted: true };
        cur.qty += l.qty;
        cur.value += l.qty * (inputCost ?? 0);
        cur.allCosted = cur.allCosted && inputCost != null;
        incoming.set(l.outputItemTypeId, cur);
      }

      const event = await tx.inventoryEvent.create({
        data: {
          kind: "WASH",
          ...(occurredAt ? { occurredAt } : {}),
          notes: dto.notes,
          createdById,
          lines: { create: lines },
        },
        include: { lines: { include: { itemType: true } } },
      });

      // Blend the washed pieces' inherited cost into each output's standard cost
      // (weighted by pre-wash warehouse qty). Only when every contributing input
      // was costed, so an uncosted input never drags the average down.
      for (const [outputId, inc] of incoming) {
        if (!inc.allCosted || inc.qty === 0) continue;
        const prevQty = Math.max(0, stock.get(outputId) ?? 0);
        const prevCost = byId.get(outputId)?.costPrice ?? 0;
        const incUnit = Math.round(inc.value / inc.qty);
        const newCost =
          prevQty > 0 && prevCost > 0
            ? Math.round((prevQty * prevCost + inc.value) / (prevQty + inc.qty))
            : incUnit;
        if (newCost !== prevCost) {
          await tx.itemType.update({ where: { id: outputId }, data: { costPrice: newCost } });
        }
      }

      return event;
    });
  }

  async list(range: { from?: string; to?: string; search?: string } = {}) {
    const search = range.search?.trim();
    return this.prisma.inventoryEvent.findMany({
      where: {
        kind: "WASH",
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
      where: { id, kind: "WASH" },
      include: {
        lines: { include: { itemType: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!event) throw new NotFoundException(`Wash ${id} not found`);
    return event;
  }

  async update(id: number, dto: UpdateWashDto) {
    const event = await this.prisma.inventoryEvent.findFirst({ where: { id, kind: "WASH" } });
    if (!event) throw new NotFoundException(`Wash ${id} not found`);
    if (event.voidedAt) throw new BadRequestException("Cannot edit a voided wash");
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

  async void(id: number, reason: string | undefined, userId: number) {
    const event = await this.prisma.inventoryEvent.findFirst({ where: { id, kind: "WASH" } });
    if (!event) throw new NotFoundException(`Wash ${id} not found`);
    if (event.voidedAt) throw new ConflictException("Wash is already voided");
    return this.prisma.inventoryEvent.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
  }
}
