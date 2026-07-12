import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateOpeningStockDto } from "./dto/opening-stock.dto";

@Injectable()
export class OpeningStockService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records an OPENING_STOCK InventoryEvent with one IN line per provided item.
   * Used to bootstrap inventory in V1 before the production pipeline (V2) is
   * built. Owner can post this from /admin/opening-stock.
   */
  async create(dto: CreateOpeningStockDto, createdById: number) {
    if (dto.items.length === 0) {
      throw new BadRequestException("At least one item is required");
    }
    const ids = [...new Set(dto.items.map((i) => i.itemTypeId))];
    const types = await this.prisma.itemType.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    });
    if (types.length !== ids.length) {
      throw new BadRequestException("One or more itemTypeId not found");
    }

    return this.prisma.inventoryEvent.create({
      data: {
        kind: "OPENING_STOCK",
        notes: dto.notes,
        createdById,
        lines: {
          create: dto.items.map((it) => ({
            direction: "IN" as const,
            location: it.location,
            itemTypeId: it.itemTypeId,
            qty: it.qty,
            unitCost: it.unitCost,
          })),
        },
      },
      include: { lines: { include: { itemType: true } } },
    });
  }

  /** Recent OPENING_STOCK events for review (voided/corrected ones hidden). */
  async list() {
    return this.prisma.inventoryEvent.findMany({
      where: { kind: "OPENING_STOCK", voidedAt: null },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { lines: { include: { itemType: true } } },
    });
  }

  /**
   * Void an opening-stock entry (to correct a mistake). Soft-delete — the entry
   * drops out of the list and its stock is reversed (aggregations exclude voided
   * events). Re-enter the corrected numbers with a new opening-stock post.
   */
  async void(id: number, userId: number) {
    const ev = await this.prisma.inventoryEvent.findUnique({ where: { id } });
    if (!ev || ev.kind !== "OPENING_STOCK") {
      throw new NotFoundException(`Opening stock ${id} not found`);
    }
    if (ev.voidedAt) return ev;
    return this.prisma.inventoryEvent.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: "Opening stock corrected" },
      include: { lines: { include: { itemType: true } } },
    });
  }
}
