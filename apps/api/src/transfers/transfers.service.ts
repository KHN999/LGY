import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { assertDateNotClosed } from "../common/backdate";
import { CreateTransferDto } from "./dto/transfer.dto";

@Injectable()
export class TransfersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateTransferDto, createdById: number) {
    if (dto.fromLocation === dto.toLocation) {
      throw new BadRequestException("from and to locations must differ");
    }
    if (dto.items.length === 0) {
      throw new BadRequestException("At least one item is required");
    }
    const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : undefined;
    await assertDateNotClosed(this.prisma, occurredAt ?? null);

    return this.prisma.$transaction(async (tx) => {
      // Aggregate requested qty per item (in case the same item appears twice).
      const requested = new Map<number, number>();
      for (const it of dto.items) {
        requested.set(it.itemTypeId, (requested.get(it.itemTypeId) ?? 0) + it.qty);
      }

      // Validate item types exist.
      const ids = [...requested.keys()];
      const types = await tx.itemType.findMany({
        where: { id: { in: ids } },
        select: { id: true, key: true },
      });
      const byId = new Map(types.map((t) => [t.id, t]));
      for (const id of ids) {
        if (!byId.has(id)) throw new BadRequestException(`ItemType ${id} not found`);
      }

      // Validate source has enough stock.
      const stockMap = await this.inventory.stockMapAt(dto.fromLocation, tx);
      for (const [id, qty] of requested) {
        const have = stockMap.get(id) ?? 0;
        if (have < qty) {
          const t = byId.get(id);
          throw new ConflictException(
            `Not enough stock for ${t?.key ?? `#${id}`} at ${dto.fromLocation}: have ${have}, need ${qty}`,
          );
        }
      }

      // Build OUT lines (from) + IN lines (to). Same itemType + qty paired.
      const linesData: {
        direction: "IN" | "OUT";
        location: "WAREHOUSE" | "SHOP" | "IN_TRANSIT";
        itemTypeId: number;
        qty: number;
      }[] = [];
      for (const it of dto.items) {
        linesData.push({
          direction: "OUT",
          location: dto.fromLocation,
          itemTypeId: it.itemTypeId,
          qty: it.qty,
        });
        linesData.push({
          direction: "IN",
          location: dto.toLocation,
          itemTypeId: it.itemTypeId,
          qty: it.qty,
        });
      }

      const event = await tx.inventoryEvent.create({
        data: {
          kind: "TRANSFER",
          ...(occurredAt ? { occurredAt } : {}),
          notes: dto.notes,
          createdById,
          lines: { create: linesData },
        },
        include: { lines: { include: { itemType: true } } },
      });

      // Optional delivery fee → a transport Expense (shows in driver activity
      // when a tracked driver is chosen; a one-off taxi is free-text).
      if (dto.driverFee && dto.driverFee > 0) {
        const category = await tx.expenseCategory.findUnique({ where: { key: "transport" } });
        if (!category) {
          throw new BadRequestException("Expense category 'transport' is missing — cannot record the delivery fee");
        }
        await tx.expense.create({
          data: {
            categoryId: category.id,
            amount: dto.driverFee,
            ...(occurredAt ? { expenseDate: occurredAt } : {}),
            paidToDriverId: dto.driverId ?? null,
            paidTo: dto.driverId ? null : dto.driverName?.trim() || "Taxi",
            eventId: event.id,
            notes: `Transfer #${event.id}`,
            createdById,
          },
        });
      }

      return event;
    });
  }

  async list(range: { from?: string; to?: string; search?: string } = {}) {
    const search = range.search?.trim();
    return this.prisma.inventoryEvent.findMany({
      where: {
        kind: "TRANSFER",
        voidedAt: null, // deleted (voided) transfers drop off the list
        ...(range.from || range.to
          ? {
              occurredAt: {
                ...(range.from ? { gte: new Date(range.from) } : {}),
                ...(range.to ? { lte: new Date(range.to) } : {}),
              },
            }
          : {}),
        // Match by item/roll (အလိပ်) name — keep transfers that include a line
        // whose item label or key contains the term.
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
        expenses: {
          where: { voidedAt: null },
          include: { paidToDriver: { select: { id: true, name: true } } },
        },
      },
    });
  }

  async getOne(id: number) {
    const event = await this.prisma.inventoryEvent.findFirst({
      where: { id, kind: "TRANSFER" },
      include: {
        lines: { include: { itemType: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
        expenses: {
          where: { voidedAt: null },
          include: { paidToDriver: { select: { id: true, name: true } } },
        },
      },
    });
    if (!event) throw new NotFoundException(`Transfer ${id} not found`);
    return event;
  }

  /**
   * Void (reverse) a transfer. The transfer is a single TRANSFER inventory event
   * (OUT@from + IN@to); voiding it makes the ledger ignore both lines, so the
   * stock moves back. Any linked delivery-fee expense is voided too. Soft — the
   * record stays for the audit trail.
   */
  async void(id: number, reason: string | undefined, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const event = await tx.inventoryEvent.findFirst({ where: { id, kind: "TRANSFER" } });
      if (!event) throw new NotFoundException(`Transfer ${id} not found`);
      if (event.voidedAt) throw new ConflictException("Transfer is already voided");

      // Reverse the delivery-fee expense, if one was recorded for this transfer.
      await tx.expense.updateMany({
        where: { eventId: id, voidedAt: null },
        data: { voidedAt: new Date(), voidedById: userId, voidReason: reason ?? "Transfer voided" },
      });

      return tx.inventoryEvent.update({
        where: { id },
        data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
      });
    });
  }
}
