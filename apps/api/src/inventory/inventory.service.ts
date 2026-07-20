import { Injectable } from "@nestjs/common";
import { Prisma, type Location } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient | PrismaService;

export interface StockRow {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  sellable: boolean;
  qty: number;
}

interface StockValueRaw {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  costPrice: number | null;
  warehouseQty: number;
  shopQty: number;
}

/**
 * The inventory ledger lives in (InventoryEvent, InventoryLine).
 * Stock at any (location, itemType) = Σ IN.qty − Σ OUT.qty for non-voided events.
 *
 * For tailor-held stock pass `tailorId` and the helper filters by location=TAILOR
 * + matching tailorId.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stock for one (location, itemType). */
  async stockAt(
    location: Location,
    itemTypeId: number,
    tx: Tx = this.prisma,
  ): Promise<number> {
    const [ins, outs] = await Promise.all([
      tx.inventoryLine.aggregate({
        where: {
          direction: "IN",
          location,
          itemTypeId,
          tailorId: null,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
      tx.inventoryLine.aggregate({
        where: {
          direction: "OUT",
          location,
          itemTypeId,
          tailorId: null,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
    ]);
    return (ins._sum.qty ?? 0) - (outs._sum.qty ?? 0);
  }

  /** Bulk: full stock map for a location, keyed by itemTypeId. */
  async stockMapAt(
    location: Location,
    tx: Tx = this.prisma,
  ): Promise<Map<number, number>> {
    // One grouped query (by direction + item) instead of two. Each DB round-trip
    // is costly on the deploy network, and inside a transaction the two old queries
    // ran serially — so we fetch once and net IN/OUT client-side.
    const rows = await tx.inventoryLine.groupBy({
      by: ["direction", "itemTypeId"],
      where: { location, tailorId: null, event: { voidedAt: null } },
      _sum: { qty: true },
    });
    const map = new Map<number, number>();
    for (const r of rows) {
      const qty = r._sum.qty ?? 0;
      map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) + (r.direction === "IN" ? qty : -qty));
    }
    return map;
  }

  /**
   * Stock rows with item metadata in one query. This backs UI stock lists, where
   * doing `stockMapAt()` and then `itemType.findMany()` would add another
   * high-latency DB round-trip.
   */
  async stockRowsAt(location: Exclude<Location, "TAILOR">): Promise<StockRow[]> {
    return this.prisma.$queryRaw<StockRow[]>(Prisma.sql`
      SELECT
        t.id AS "itemTypeId",
        t.key,
        t."labelMy",
        t.emoji,
        t."sortOrder",
        t."isActive",
        t.sellable,
        COALESCE(
          SUM(
            CASE
              WHEN ev."voidedAt" IS NULL AND il.direction = 'IN'::"InventoryDirection" THEN il.qty
              WHEN ev."voidedAt" IS NULL AND il.direction = 'OUT'::"InventoryDirection" THEN -il.qty
              ELSE 0
            END
          ),
          0
        )::int AS qty
      FROM "ItemType" t
      LEFT JOIN "InventoryLine" il
        ON il."itemTypeId" = t.id
       AND il.location = ${location}::"Location"
       AND il."tailorId" IS NULL
      LEFT JOIN "InventoryEvent" ev ON ev.id = il."eventId"
      GROUP BY t.id
      ORDER BY t."sortOrder" ASC, t.id ASC
    `);
  }

  /**
   * Stock valuation across warehouse + shop: each item's on-hand qty × its
   * admin-set costPrice. Rolls are valued per yard, pieces per piece. Items with
   * zero stock are dropped; items with stock but no cost set are surfaced so the
   * admin knows the total is understated.
   */
  async valuation() {
    const rows = await this.prisma.$queryRaw<StockValueRaw[]>(Prisma.sql`
      SELECT
        t.id AS "itemTypeId",
        t.key,
        t."labelMy",
        t.emoji,
        t."costPrice",
        COALESCE(SUM(CASE
          WHEN ev."voidedAt" IS NULL AND il.location = 'WAREHOUSE'::"Location" AND il.direction = 'IN'::"InventoryDirection" THEN il.qty
          WHEN ev."voidedAt" IS NULL AND il.location = 'WAREHOUSE'::"Location" AND il.direction = 'OUT'::"InventoryDirection" THEN -il.qty
          ELSE 0 END), 0)::int AS "warehouseQty",
        COALESCE(SUM(CASE
          WHEN ev."voidedAt" IS NULL AND il.location = 'SHOP'::"Location" AND il.direction = 'IN'::"InventoryDirection" THEN il.qty
          WHEN ev."voidedAt" IS NULL AND il.location = 'SHOP'::"Location" AND il.direction = 'OUT'::"InventoryDirection" THEN -il.qty
          ELSE 0 END), 0)::int AS "shopQty"
      FROM "ItemType" t
      LEFT JOIN "InventoryLine" il
        ON il."itemTypeId" = t.id
       AND il."tailorId" IS NULL
       AND il.location IN ('WAREHOUSE'::"Location", 'SHOP'::"Location")
      LEFT JOIN "InventoryEvent" ev ON ev.id = il."eventId"
      GROUP BY t.id
      ORDER BY t."sortOrder" ASC, t.id ASC
    `);

    const items = rows
      .map((r) => {
        const cost = r.costPrice ?? 0;
        const warehouseValue = r.warehouseQty * cost;
        const shopValue = r.shopQty * cost;
        return { ...r, warehouseValue, shopValue, totalValue: warehouseValue + shopValue };
      })
      .filter((r) => r.warehouseQty !== 0 || r.shopQty !== 0)
      .sort((a, b) => b.totalValue - a.totalValue);

    const totals = {
      warehouseValue: items.reduce((s, r) => s + r.warehouseValue, 0),
      shopValue: items.reduce((s, r) => s + r.shopValue, 0),
      totalValue: items.reduce((s, r) => s + r.totalValue, 0),
      uncostedCount: items.filter((r) => r.costPrice == null).length,
    };
    return { items, totals };
  }

  /** Bulk: stock currently with a specific tailor. */
  async stockMapAtTailor(
    tailorId: number,
    tx: Tx = this.prisma,
  ): Promise<Map<number, number>> {
    const rows = await tx.inventoryLine.groupBy({
      by: ["direction", "itemTypeId"],
      where: { location: "TAILOR", tailorId, event: { voidedAt: null } },
      _sum: { qty: true },
    });
    const map = new Map<number, number>();
    for (const r of rows) {
      const qty = r._sum.qty ?? 0;
      map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) + (r.direction === "IN" ? qty : -qty));
    }
    return map;
  }

  async stockRowsAtTailor(tailorId: number): Promise<StockRow[]> {
    const rows = await this.prisma.$queryRaw<StockRow[]>(Prisma.sql`
      SELECT
        t.id AS "itemTypeId",
        t.key,
        t."labelMy",
        t.emoji,
        t."sortOrder",
        t."isActive",
        t.sellable,
        COALESCE(
          SUM(
            CASE
              WHEN ev."voidedAt" IS NULL AND il.direction = 'IN'::"InventoryDirection" THEN il.qty
              WHEN ev."voidedAt" IS NULL AND il.direction = 'OUT'::"InventoryDirection" THEN -il.qty
              ELSE 0
            END
          ),
          0
        )::int AS qty
      FROM "ItemType" t
      LEFT JOIN "InventoryLine" il
        ON il."itemTypeId" = t.id
       AND il.location = 'TAILOR'::"Location"
       AND il."tailorId" = ${tailorId}
      LEFT JOIN "InventoryEvent" ev ON ev.id = il."eventId"
      GROUP BY t.id
      HAVING COALESCE(
        SUM(
          CASE
            WHEN ev."voidedAt" IS NULL AND il.direction = 'IN'::"InventoryDirection" THEN il.qty
            WHEN ev."voidedAt" IS NULL AND il.direction = 'OUT'::"InventoryDirection" THEN -il.qty
            ELSE 0
          END
        ),
        0
      ) > 0
      ORDER BY t."sortOrder" ASC, t.id ASC
    `);
    return rows;
  }
}
