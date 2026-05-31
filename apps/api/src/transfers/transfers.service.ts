import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
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

      return tx.inventoryEvent.create({
        data: {
          kind: "TRANSFER",
          notes: dto.notes,
          createdById,
          lines: { create: linesData },
        },
        include: { lines: { include: { itemType: true } } },
      });
    });
  }

  async list(range: { from?: string; to?: string } = {}) {
    return this.prisma.inventoryEvent.findMany({
      where: {
        kind: "TRANSFER",
        ...(range.from || range.to
          ? {
              occurredAt: {
                ...(range.from ? { gte: new Date(range.from) } : {}),
                ...(range.to ? { lte: new Date(range.to) } : {}),
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
      where: { id, kind: "TRANSFER" },
      include: {
        lines: { include: { itemType: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!event) throw new NotFoundException(`Transfer ${id} not found`);
    return event;
  }
}
