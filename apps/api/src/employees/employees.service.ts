import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto";

@Injectable()
export class EmployeesService {
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
      this.prisma.employee.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      this.prisma.employee.count({ where }),
    ]);
    return { data: rows, page, limit, total };
  }

  async getOne(id: number) {
    const row = await this.prisma.employee.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`Employee ${id} not found`);
    return row;
  }

  async create(dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: { ...dto, status: dto.status ?? "ACTIVE" },
    });
  }

  async update(id: number, dto: UpdateEmployeeDto) {
    const existing = await this.prisma.employee.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Employee ${id} not found`);
    return this.prisma.employee.update({
      where: { id },
      data: { ...dto },
    });
  }
}
