import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type AuditLog } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { ShopId } from "../prisma/shop-context";
import type { PageResult } from "../common/pagination.dto";

/** Human-facing detail resolved live from the entity an audit row refers to, in
 *  that row's OWN shop — used where the stored request body only has ids (a sale
 *  logs "customer #17"; the item catalog + parties differ per shop) or can't
 *  explain what happened at all (a stock-exception resolve stores no item and no
 *  before/after). All fields optional; null when nothing extra could be resolved. */
export interface AuditReceipt {
  data: {
    saleId: number | null;
    date: string;
    customerName: string | null;
    customerContact: string | null;
    lines: { label: string; qty: number; unitPrice: number; lineTotal: number; note: string | null }[];
    grandTotal: number;
    paid: number;
  };
  shop: {
    shopName: string;
    addressLine: string | null;
    phone: string | null;
    social: string | null;
    receiptHeader: string | null;
    receiptFooter: string | null;
  } | null;
  voided: boolean;
}

export interface AuditEntityContext {
  customerName?: string | null;
  supplierName?: string | null;
  /** itemTypeId → labelMy, for every item referenced in the payload. */
  itemNames?: Record<string, string>;
  stockChange?: {
    item: { name: string; emoji: string | null };
    location: string;
    recounted: boolean;
    before: number | null;
    after: number | null;
  };
  /** The live sale receipt (same as staff sale history), for sale rows. */
  receipt?: AuditReceipt;
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
   * that row's own shop schema. Fills in the names the stored request body only
   * has as ids (customer/supplier/items), and for a stock-exception resolve
   * reconstructs the item + before/after: `after` is the recorded countedQty,
   * `before = after − delta` where delta is what the resolution event posted.
   * Returns null when nothing extra could be resolved.
   */
  async entityContext(id: number): Promise<AuditEntityContext | null> {
    const row = await this.prisma.main.auditLog.findUnique({ where: { id } });
    if (!row) return null;

    const shop: ShopId = row.shop === "playground" ? "playground" : "main";
    const db = this.prisma.clientForShop(shop);
    const payload = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<
      string,
      unknown
    >;
    const ctx: AuditEntityContext = {};

    // Party names — resolved in the row's own shop (ids mean different records per shop).
    const custId = Number(payload.customerId);
    if (Number.isInteger(custId)) {
      ctx.customerName =
        (await db.customer.findUnique({ where: { id: custId }, select: { name: true } }))?.name ?? null;
    }
    const supId = Number(payload.supplierId);
    if (Number.isInteger(supId)) {
      ctx.supplierName =
        (await db.supplier.findUnique({ where: { id: supId }, select: { name: true } }))?.name ?? null;
    }

    // Item names referenced anywhere in the payload (sale/transfer lines, counts, …).
    const itemIds = new Set<number>();
    for (const arr of [payload.items, payload.counts, payload.lines]) {
      if (Array.isArray(arr)) {
        for (const i of arr) {
          const n = Number((i as Record<string, unknown>)?.itemTypeId);
          if (Number.isInteger(n)) itemIds.add(n);
        }
      }
    }
    if (Number.isInteger(Number(payload.itemTypeId))) itemIds.add(Number(payload.itemTypeId));
    if (itemIds.size) {
      const types = await db.itemType.findMany({
        where: { id: { in: [...itemIds] } },
        select: { id: true, labelMy: true },
      });
      if (types.length) ctx.itemNames = Object.fromEntries(types.map((t) => [String(t.id), t.labelMy]));
    }

    // Sale → the live receipt (same as staff sale history). New rows carry the
    // sale id in entityId; older rows (created before that was captured) are
    // matched by customer + total within a short window of the audit time.
    if (row.entity === "sales" && !row.path.endsWith("/void")) {
      let saleId = row.entityId ? Number(row.entityId) : null;
      if (!saleId) {
        const items = Array.isArray(payload.items) ? (payload.items as Array<Record<string, unknown>>) : [];
        if (items.length) {
          const total =
            items.reduce((s, i) => s + Number(i.qty ?? 0) * Number(i.unitPrice ?? 0), 0) -
            Number(payload.discount ?? 0);
          const when = row.createdAt;
          const custName = typeof payload.customerName === "string" ? payload.customerName : null;
          const match = await db.sale.findFirst({
            where: {
              grandTotal: total,
              ...(Number.isInteger(custId)
                ? { customerId: custId }
                : custName
                  ? { customerName: custName }
                  : {}),
              createdAt: { gte: new Date(when.getTime() - 120_000), lte: new Date(when.getTime() + 5_000) },
            },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          saleId = match?.id ?? null;
        }
      }
      if (saleId) {
        const sale = await db.sale.findUnique({
          where: { id: saleId },
          include: {
            lines: { include: { itemType: { select: { labelMy: true } } } },
            customer: { select: { name: true, contact: true } },
          },
        });
        if (sale) {
          const s = await db.shopSetting.findUnique({ where: { id: 1 } });
          ctx.receipt = {
            data: {
              saleId: sale.id,
              date: sale.saleDate.toISOString(),
              customerName: sale.customer?.name ?? sale.customerName ?? null,
              customerContact: sale.customer?.contact ?? null,
              lines: sale.lines.map((l) => ({
                label: l.itemType?.labelMy ?? l.itemName ?? "",
                qty: l.qty,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                note: l.note,
              })),
              grandTotal: sale.grandTotal,
              paid: sale.paidAmount,
            },
            shop: s
              ? {
                  shopName: s.shopName,
                  addressLine: s.addressLine,
                  phone: s.phone,
                  social: s.social,
                  receiptHeader: s.receiptHeader,
                  receiptFooter: s.receiptFooter,
                }
              : null,
            voided: sale.voidedAt != null,
          };
        }
      }
    }

    // Stock-exception resolve → item + before/after from the resolution event.
    if (row.entity === "stock-exceptions" && row.entityId) {
      const ex = await db.stockException.findUnique({
        where: { id: Number(row.entityId) },
        include: {
          itemType: { select: { labelMy: true, emoji: true } },
          resolutionEvent: { include: { lines: true } },
        },
      });
      if (ex) {
        const item = { name: ex.itemType?.labelMy ?? `#${ex.itemTypeId}`, emoji: ex.itemType?.emoji ?? null };
        const after = payload.countedQty != null ? Number(payload.countedQty) : null;
        if (!ex.resolutionEvent) {
          ctx.stockChange = { item, location: ex.location, recounted: after != null, before: after, after };
        } else {
          let delta = 0;
          for (const l of ex.resolutionEvent.lines) {
            if (l.itemTypeId === ex.itemTypeId && l.location === ex.location) {
              delta += l.direction === "IN" ? l.qty : -l.qty;
            }
          }
          ctx.stockChange = {
            item,
            location: ex.location,
            recounted: true,
            before: after != null ? after - delta : null,
            after,
          };
        }
      }
    }

    return Object.keys(ctx).length ? ctx : null;
  }
}
