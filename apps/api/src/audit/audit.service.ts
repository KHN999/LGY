import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AuditLog } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { ShopId } from "../prisma/shop-context";
import type { PageResult } from "../common/pagination.dto";

/** Human-facing detail resolved live from the entity an audit row refers to —
 *  used where the request body alone can't explain what happened (e.g. a
 *  stock-exception resolve stores no item and no before/after). */
export interface AuditEntityContext {
  kind: "stock-exception";
  item: { name: string; emoji: string | null };
  location: string;
  recounted: boolean;
  before: number | null;
  after: number | null;
}

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

  async getOne(id: number): Promise<AuditLog> {
    const row = await this.prisma.main.auditLog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`AuditLog ${id} not found`);
    return row;
  }

  /**
   * Resolve display context for an audit row from the ENTITY it points at, in
   * that row's own shop schema. Currently covers stock-exception resolves: the
   * request body records neither the item nor a before/after, so we read the
   * exception + its resolution ADJUSTMENT event and reconstruct both. `after`
   * comes from the recorded countedQty; `before = after − delta` where delta is
   * the signed quantity the resolution event posted. Returns null when there's
   * nothing extra to show.
   */
  async entityContext(id: number): Promise<AuditEntityContext | null> {
    const row = await this.prisma.main.auditLog.findUnique({ where: { id } });
    if (!row || row.entity !== "stock-exceptions" || !row.entityId) return null;

    const shop: ShopId = row.shop === "playground" ? "playground" : "main";
    const db = this.prisma.clientForShop(shop);
    const ex = await db.stockException.findUnique({
      where: { id: Number(row.entityId) },
      include: {
        itemType: { select: { labelMy: true, emoji: true } },
        resolutionEvent: { include: { lines: true } },
      },
    });
    if (!ex) return null;

    const item = {
      name: ex.itemType?.labelMy ?? `#${ex.itemTypeId}`,
      emoji: ex.itemType?.emoji ?? null,
    };
    const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<
      string,
      unknown
    >;
    const after = payload.countedQty != null ? Number(payload.countedQty) : null;
    const recounted = after != null;

    if (!ex.resolutionEvent) {
      // Closed without a recount, or recounted but already matched (no delta) —
      // either way the ledger didn't move.
      return { kind: "stock-exception", item, location: ex.location, recounted, before: after, after };
    }

    let delta = 0;
    for (const l of ex.resolutionEvent.lines) {
      if (l.itemTypeId === ex.itemTypeId && l.location === ex.location) {
        delta += l.direction === "IN" ? l.qty : -l.qty;
      }
    }
    const before = after != null ? after - delta : null;
    return { kind: "stock-exception", item, location: ex.location, recounted: true, before, after };
  }
}
