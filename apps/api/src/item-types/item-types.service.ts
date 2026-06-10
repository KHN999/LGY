import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateItemTypeDto, UpdateItemTypeDto } from "./dto/item-type.dto";

@Injectable()
export class ItemTypesService {
  constructor(private readonly prisma: PrismaService) {}

  // activeOnly=false means "all" here (the admin management list shows active +
  // inactive, badging the inactive ones) — NOT "inactive only" like the party
  // lists, which have an explicit Active/Inactive tab.
  async list(opts: { activeOnly?: boolean }) {
    return this.prisma.itemType.findMany({
      where: opts.activeOnly !== false ? { isActive: true } : {},
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    });
  }

  async getOne(id: number) {
    const row = await this.prisma.itemType.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`ItemType ${id} not found`);
    return row;
  }

  async create(dto: CreateItemTypeDto) {
    try {
      return await this.prisma.itemType.create({
        data: {
          key: dto.key,
          labelMy: dto.labelMy,
          emoji: dto.emoji,
          sortOrder: dto.sortOrder ?? 0,
          isActive: dto.isActive ?? true,
          sellable: dto.sellable ?? true,
        },
      });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2002") {
        throw new ConflictException(`ItemType key "${dto.key}" already exists`);
      }
      throw e;
    }
  }

  async update(id: number, dto: UpdateItemTypeDto) {
    const existing = await this.prisma.itemType.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`ItemType ${id} not found`);
    return this.prisma.itemType.update({
      where: { id },
      data: {
        ...(dto.key !== undefined ? { key: dto.key } : {}),
        ...(dto.labelMy !== undefined ? { labelMy: dto.labelMy } : {}),
        ...(dto.emoji !== undefined ? { emoji: dto.emoji } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sellable !== undefined ? { sellable: dto.sellable } : {}),
      },
    });
  }

  /** Hard-delete an item type, but only if nothing references it. Anything with
   *  history (sales, stock movements, supplier orders, exceptions, returns) must
   *  be deactivated instead — deleting it would break those records. */
  async remove(id: number) {
    const [saleLines, inventoryLines, supplierOrders, stockExceptions, saleReturnLines] =
      await Promise.all([
        this.prisma.saleLine.count({ where: { itemTypeId: id } }),
        this.prisma.inventoryLine.count({ where: { itemTypeId: id } }),
        this.prisma.supplierOrder.count({ where: { itemTypeId: id } }),
        this.prisma.stockException.count({ where: { itemTypeId: id } }),
        this.prisma.saleReturnLine.count({ where: { itemTypeId: id } }),
      ]);
    const refs = saleLines + inventoryLines + supplierOrders + stockExceptions + saleReturnLines;
    if (refs > 0) {
      throw new ConflictException(
        "This item type has history (sales, stock, or orders) and can't be deleted. Set it inactive instead.",
      );
    }
    try {
      await this.prisma.itemType.delete({ where: { id } });
    } catch (e: unknown) {
      if ((e as { code?: string }).code === "P2025") {
        throw new NotFoundException(`ItemType ${id} not found`);
      }
      throw e;
    }
    return { ok: true };
  }
}
