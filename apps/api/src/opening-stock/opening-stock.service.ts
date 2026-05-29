import { BadRequestException, Injectable } from "@nestjs/common";
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
      include: { lines: true },
    });
  }

  /** Recent OPENING_STOCK events for review. */
  async list() {
    return this.prisma.inventoryEvent.findMany({
      where: { kind: "OPENING_STOCK" },
      orderBy: { occurredAt: "desc" },
      take: 50,
      include: { lines: { include: { itemType: true } } },
    });
  }
}
