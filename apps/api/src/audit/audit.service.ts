import { Injectable } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";

export interface AuditListQuery {
  page: number;
  limit: number;
  shop?: string;
  userId?: number;
  entity?: string;
  failuresOnly?: boolean;
  search?: string;
  from?: string;
  to?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** The whole audit log lives in the main schema, so always read via .main. */
  async list(q: AuditListQuery): Promise<PageResult<unknown>> {
    const where: Prisma.AuditLogWhereInput = {
      ...(q.shop ? { shop: q.shop } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.entity ? { entity: q.entity } : {}),
      ...(q.failuresOnly ? { ok: false } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
      ...(q.search
        ? {
            OR: [
              { path: { contains: q.search, mode: "insensitive" } },
              { username: { contains: q.search, mode: "insensitive" } },
              { entity: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.main.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.main.auditLog.count({ where }),
    ]);

    return { data, page: q.page, limit: q.limit, total };
  }
}
