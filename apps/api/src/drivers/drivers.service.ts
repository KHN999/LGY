import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateDriverDto, UpdateDriverDto } from "./dto/driver.dto";

@Injectable()
export class DriversService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
  }): Promise<PageResult<unknown>> {
    const { page, limit, search, activeOnly = true } = opts;
    const where = {
      ...(activeOnly ? { status: "ACTIVE" as const } : {}),
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
      this.prisma.driver.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.driver.count({ where }),
    ]);
    return { data: rows, page, limit, total };
  }

  async getOne(id: number) {
    const row = await this.prisma.driver.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Driver ${id} not found`);
    return row;
  }

  async create(dto: CreateDriverDto) {
    return this.prisma.driver.create({
      data: { ...dto, status: dto.status ?? "ACTIVE" },
    });
  }

  async update(id: number, dto: UpdateDriverDto) {
    const existing = await this.prisma.driver.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Driver ${id} not found`);
    return this.prisma.driver.update({
      where: { id },
      data: { ...dto },
    });
  }
}
