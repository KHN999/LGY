import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateItemTypeDto, UpdateItemTypeDto } from "./dto/item-type.dto";

@Injectable()
export class ItemTypesService {
  constructor(private readonly prisma: PrismaService) {}

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
      },
    });
  }
}
