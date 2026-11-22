import { Injectable } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";

/** Shift a stored UTC timestamp to Yangon wall-clock (+06:30) for day/month grouping. */
const YGN = Prisma.sql`interval '390 minutes'`;
const DAY_MS = 86_400_000;

export interface MonthRow { month: string; orders: number; revenue: number; walkinOrders: number; walkinRevenue: number; days: number }
export interface CollectRow { month: string; total: number; cash: number; bank: number; atSale: number; debt: number }
export interface WeekRow { week: Date; orders: number; revenue: number }
export interface ItemRow { itemTypeId: number; labelMy: string; qty: number; revenue: number; qty30: number; costPrice: number | null }
export interface ManualRow { lines: number; revenue: number }
export interface CustRow {
  id: number; name: string; deleted: boolean; orders: number; revenue: number; paid: number; returned: number; refunded: number;
  firstSale: Date | null; lastSale: Date | null; lastPayment: Date | null;
}
export interface MixRow { method: string; bank: string | null; count: number; total: number }
export interface DowRow { dow: number; orders: number; revenue: number }
export interface ProdRow { kind: string; month: string; events: number; qtyIn: number }
export interface HygieneRow {
  sales: number; voidedSales: number; saleDays: number; closedSaleDays: number; closes: number; closesOff: number;
  closeDiff: number; openExceptions: number; expenses: number; expenseTotal: number; returns: number;
  returnTotal: number; refundTotal: number; supplierOrdered: number; supplierPaid: number; tailorCharged: number;
  tailorPaid: number; firstSale: Date | null; lastSale: Date | null;
}

/**
 * Whole-business overview for the /data-analysis page: sales and collection
 * trends, product and customer mix, receivables, stock cover, production flow
 * and record-keeping gaps. Read-only; everything is computed from the active
 * shop's raw rows (non-voided), grouped by Yangon day/month.
 */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async overview() {
    const db = this.prisma;
    // Independent reads — run together (each DB round-trip is costly in prod).
    const [months, collections, weeks, items, manual, custs, mix, dows, prod, hyg, stock] =
      await Promise.all([
        db.$queryRaw<MonthRow[]>(Prisma.sql`
          SELECT to_char("saleDate" + ${YGN}, 'YYYY-MM') AS month,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM("grandTotal"), 0)::float8 AS revenue,
                 COUNT(*) FILTER (WHERE "customerId" IS NULL)::int AS "walkinOrders",
                 COALESCE(SUM("grandTotal") FILTER (WHERE "customerId" IS NULL), 0)::float8 AS "walkinRevenue",
                 COUNT(DISTINCT ("saleDate" + ${YGN})::date)::int AS days
          FROM "Sale" WHERE "voidedAt" IS NULL
          GROUP BY 1 ORDER BY 1`),
        db.$queryRaw<CollectRow[]>(Prisma.sql`
          SELECT to_char("paymentDate" + ${YGN}, 'YYYY-MM') AS month,
                 COALESCE(SUM(amount), 0)::float8 AS total,
                 COALESCE(SUM(amount) FILTER (WHERE method::text = 'CASH'), 0)::float8 AS cash,
                 COALESCE(SUM(amount) FILTER (WHERE method::text <> 'CASH'), 0)::float8 AS bank,
                 COALESCE(SUM(amount) FILTER (WHERE "saleId" IS NOT NULL), 0)::float8 AS "atSale",
                 COALESCE(SUM(amount) FILTER (WHERE "saleId" IS NULL), 0)::float8 AS debt
          FROM "CustomerPayment" WHERE "voidedAt" IS NULL
          GROUP BY 1 ORDER BY 1`),
        db.$queryRaw<WeekRow[]>(Prisma.sql`
          SELECT date_trunc('week', "saleDate" + ${YGN}) AS week,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM("grandTotal"), 0)::float8 AS revenue
          FROM "Sale"
          WHERE "voidedAt" IS NULL AND "saleDate" >= now() - interval '84 days'
          GROUP BY 1 ORDER BY 1`),
        db.$queryRaw<ItemRow[]>(Prisma.sql`
          SELECT t.id AS "itemTypeId", t."labelMy",
                 COALESCE(SUM(l.qty), 0)::float8 AS qty,
                 COALESCE(SUM(l."lineTotal"), 0)::float8 AS revenue,
                 COALESCE(SUM(l.qty) FILTER (WHERE s."saleDate" >= now() - interval '30 days'), 0)::float8 AS qty30,
                 t."costPrice"
          FROM "SaleLine" l
          JOIN "Sale" s ON s.id = l."saleId" AND s."voidedAt" IS NULL
          JOIN "ItemType" t ON t.id = l."itemTypeId"
          GROUP BY t.id ORDER BY revenue DESC`),
        db.$queryRaw<ManualRow[]>(Prisma.sql`
          SELECT COUNT(*)::int AS lines,
                 COALESCE(SUM(l."lineTotal"), 0)::float8 AS revenue
          FROM "SaleLine" l
          JOIN "Sale" s ON s.id = l."saleId" AND s."voidedAt" IS NULL
          WHERE l."itemTypeId" IS NULL`),
        db.$queryRaw<CustRow[]>(Prisma.sql`
          WITH sa AS (
            SELECT "customerId" AS id, COUNT(*)::int AS orders, SUM("grandTotal")::float8 AS revenue,
                   MIN("saleDate") AS "firstSale", MAX("saleDate") AS "lastSale"
            FROM "Sale" WHERE "voidedAt" IS NULL AND "customerId" IS NOT NULL GROUP BY 1
          ), pa AS (
            SELECT "customerId" AS id, SUM(amount)::float8 AS paid, MAX("paymentDate") AS "lastPayment"
            FROM "CustomerPayment" WHERE "voidedAt" IS NULL AND "customerId" IS NOT NULL GROUP BY 1
          ), re AS (
            SELECT "customerId" AS id, SUM("returnTotal")::float8 AS returned, SUM("refundAmount")::float8 AS refunded
            FROM "SaleReturn" WHERE "voidedAt" IS NULL AND "customerId" IS NOT NULL GROUP BY 1
          )
          SELECT c.id, c.name, (c."deletedAt" IS NOT NULL) AS deleted,
                 COALESCE(sa.orders, 0)::int AS orders,
                 COALESCE(sa.revenue, 0)::float8 AS revenue,
                 COALESCE(pa.paid, 0)::float8 AS paid,
                 COALESCE(re.returned, 0)::float8 AS returned,
                 COALESCE(re.refunded, 0)::float8 AS refunded,
                 sa."firstSale", sa."lastSale", pa."lastPayment"
          FROM "Customer" c
          LEFT JOIN sa ON sa.id = c.id
          LEFT JOIN pa ON pa.id = c.id
          LEFT JOIN re ON re.id = c.id`),
        db.$queryRaw<MixRow[]>(Prisma.sql`
          SELECT method::text AS method, bank, COUNT(*)::int AS count, COALESCE(SUM(amount), 0)::float8 AS total
          FROM "CustomerPayment" WHERE "voidedAt" IS NULL
          GROUP BY 1, 2 ORDER BY total DESC`),
        db.$queryRaw<DowRow[]>(Prisma.sql`
          SELECT EXTRACT(isodow FROM "saleDate" + ${YGN})::int AS dow,
                 COUNT(*)::int AS orders,
                 COALESCE(SUM("grandTotal"), 0)::float8 AS revenue
          FROM "Sale" WHERE "voidedAt" IS NULL
          GROUP BY 1 ORDER BY 1`),
        db.$queryRaw<ProdRow[]>(Prisma.sql`
          SELECT e.kind::text AS kind,
                 to_char(e."occurredAt" + ${YGN}, 'YYYY-MM') AS month,
                 COUNT(DISTINCT e.id)::int AS events,
                 COALESCE(SUM(l.qty) FILTER (WHERE l.direction = 'IN'::"InventoryDirection"), 0)::float8 AS "qtyIn"
          FROM "InventoryEvent" e
          JOIN "InventoryLine" l ON l."eventId" = e.id
          WHERE e."voidedAt" IS NULL
            AND e.kind::text IN ('RECEIPT', 'CUT', 'TAILOR_SEND', 'TAILOR_RETURN', 'TRANSFER')
          GROUP BY 1, 2 ORDER BY 2, 1`),
        db.$queryRaw<HygieneRow[]>(Prisma.sql`
          WITH sd AS (
            SELECT DISTINCT ("saleDate" + ${YGN})::date AS d FROM "Sale" WHERE "voidedAt" IS NULL
          ), cd AS (
            SELECT ("closeDate" + ${YGN})::date AS d, difference FROM "DailyClose"
          ), ord AS (
            SELECT id, "expectedTotal" FROM "SupplierOrder" WHERE status::text <> 'CANCELLED'
          )
          SELECT
            (SELECT COUNT(*) FROM "Sale")::int AS sales,
            (SELECT COUNT(*) FROM "Sale" WHERE "voidedAt" IS NOT NULL)::int AS "voidedSales",
            (SELECT COUNT(*) FROM sd)::int AS "saleDays",
            (SELECT COUNT(*) FROM sd WHERE d IN (SELECT d FROM cd))::int AS "closedSaleDays",
            (SELECT COUNT(*) FROM cd)::int AS closes,
            (SELECT COUNT(*) FROM cd WHERE difference <> 0)::int AS "closesOff",
            (SELECT COALESCE(SUM(difference), 0) FROM cd)::float8 AS "closeDiff",
            (SELECT COUNT(*) FROM "StockException" WHERE status::text = 'OPEN')::int AS "openExceptions",
            (SELECT COUNT(*) FROM "Expense" WHERE "voidedAt" IS NULL)::int AS expenses,
            (SELECT COALESCE(SUM(amount), 0) FROM "Expense" WHERE "voidedAt" IS NULL)::float8 AS "expenseTotal",
            (SELECT COUNT(*) FROM "SaleReturn" WHERE "voidedAt" IS NULL)::int AS returns,
            (SELECT COALESCE(SUM("returnTotal"), 0) FROM "SaleReturn" WHERE "voidedAt" IS NULL)::float8 AS "returnTotal",
            (SELECT COALESCE(SUM("refundAmount"), 0) FROM "SaleReturn" WHERE "voidedAt" IS NULL)::float8 AS "refundTotal",
            (SELECT COALESCE(SUM("expectedTotal"), 0) FROM ord)::float8 AS "supplierOrdered",
            (SELECT COALESCE(SUM(amount), 0) FROM "SupplierPayment"
              WHERE "voidedAt" IS NULL AND "orderId" IN (SELECT id FROM ord))::float8 AS "supplierPaid",
            (SELECT COALESCE(SUM(amount), 0) FROM "TailorCharge" WHERE "voidedAt" IS NULL)::float8 AS "tailorCharged",
            (SELECT COALESCE(SUM(amount), 0) FROM "TailorPayment" WHERE "voidedAt" IS NULL)::float8 AS "tailorPaid",
            (SELECT MIN("saleDate") FROM "Sale" WHERE "voidedAt" IS NULL) AS "firstSale",
            (SELECT MAX("saleDate") FROM "Sale" WHERE "voidedAt" IS NULL) AS "lastSale"`),
        this.inventory.valuation(),
      ]);

    const now = Date.now();
    const h = hyg[0];
    const totalRevenue = months.reduce((s, m) => s + m.revenue, 0);
    const totalOrders = months.reduce((s, m) => s + m.orders, 0);
    const walkinRevenue = months.reduce((s, m) => s + m.walkinRevenue, 0);
    const totalCollected = collections.reduce((s, m) => s + m.total, 0);

    // ── Months: sales beside the money actually collected that month ──
    const collectByMonth = new Map(collections.map((c) => [c.month, c]));
    const monthKeys = [...new Set([...months.map((m) => m.month), ...collections.map((c) => c.month)])].sort();
    const saleByMonth = new Map(months.map((m) => [m.month, m]));
    const monthly = monthKeys.map((k) => {
      const s = saleByMonth.get(k);
      const c = collectByMonth.get(k);
      return {
        month: k,
        orders: s?.orders ?? 0,
        revenue: s?.revenue ?? 0,
        days: s?.days ?? 0,
        walkinRevenue: s?.walkinRevenue ?? 0,
        collected: c?.total ?? 0,
        cash: c?.cash ?? 0,
        bank: c?.bank ?? 0,
        debtCollected: c?.debt ?? 0,
      };
    });

    // ── Products: margin uses TODAY's cost price (cost history isn't kept) ──
    const products = items.map((i) => {
      const avgPrice = i.qty > 0 ? i.revenue / i.qty : 0;
      const st = stock.items.find((x) => x.itemTypeId === i.itemTypeId);
      const onHand = (st?.warehouseQty ?? 0) + (st?.shopQty ?? 0);
      const perDay = i.qty30 / 30;
      return {
        itemTypeId: i.itemTypeId,
        label: i.labelMy,
        qty: i.qty,
        revenue: i.revenue,
        share: totalRevenue > 0 ? i.revenue / totalRevenue : 0,
        avgPrice: Math.round(avgPrice),
        costPrice: i.costPrice,
        marginPct: i.costPrice != null && avgPrice > 0 ? (avgPrice - i.costPrice) / avgPrice : null,
        belowCost: i.costPrice != null && avgPrice > 0 && avgPrice < i.costPrice,
        grossProfit: i.costPrice != null ? i.revenue - i.costPrice * i.qty : null,
        qty30: i.qty30,
        onHand,
        atTailors: st?.tailorQty ?? 0,
        daysCover: perDay > 0 ? Math.round(onHand / perDay) : null,
      };
    });
    const costed = products.filter((p) => p.grossProfit != null);
    const costedRevenue = costed.reduce((s, p) => s + p.revenue, 0);
    const grossProfit = costed.reduce((s, p) => s + (p.grossProfit ?? 0), 0);

    // Stock that is on hand but has not sold at all in the last 30 days.
    const soldIds = new Set(products.filter((p) => p.qty30 > 0).map((p) => p.itemTypeId));
    const idleStock = stock.items
      .filter((s) => !soldIds.has(s.itemTypeId) && s.warehouseQty + s.shopQty > 0)
      .map((s) => ({ label: s.labelMy, qty: s.warehouseQty + s.shopQty, value: s.warehouseValue + s.shopValue }))
      .sort((a, b) => b.value - a.value);
    const negativeStock = stock.items
      .filter((s) => s.warehouseQty < 0 || s.shopQty < 0)
      .map((s) => ({ label: s.labelMy, warehouseQty: s.warehouseQty, shopQty: s.shopQty }));

    // ── Customers & receivables (same balance formula as the customers list) ──
    // Deleting a customer hides them — and whatever they still owe — from every
    // debt list, but their sales stay in revenue. Keep that visible here.
    const live = custs.filter((c) => !c.deleted);
    const gone = custs
      .filter((c) => c.deleted)
      .map((c) => ({ ...c, balance: c.revenue - c.returned - c.paid + c.refunded }));
    const withBalance = live.map((c) => {
      const balance = c.revenue - c.returned - c.paid + c.refunded;
      const lastActivity = c.lastPayment ?? c.lastSale;
      return {
        ...c,
        balance,
        daysSincePayment: lastActivity ? Math.floor((now - new Date(lastActivity).getTime()) / DAY_MS) : null,
      };
    });
    const buyers = withBalance.filter((c) => c.orders > 0).sort((a, b) => b.revenue - a.revenue);
    const accountRevenue = buyers.reduce((s, c) => s + c.revenue, 0);
    const topShare = (n: number) =>
      totalRevenue > 0 ? buyers.slice(0, n).reduce((s, c) => s + c.revenue, 0) / totalRevenue : 0;
    const active = (days: number) =>
      buyers.filter((c) => c.lastSale && now - new Date(c.lastSale).getTime() <= days * DAY_MS).length;

    const debtors = withBalance.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance);
    const receivable = debtors.reduce((s, c) => s + c.balance, 0);
    const bucket = (lo: number, hi: number) => {
      const rows = debtors.filter((c) => (c.daysSincePayment ?? 9999) >= lo && (c.daysSincePayment ?? 9999) < hi);
      return { count: rows.length, amount: rows.reduce((s, c) => s + c.balance, 0) };
    };
    const inCredit = withBalance.filter((c) => c.balance < 0);

    // ── Production flow: events + pieces/rolls received per kind per month ──
    const flowKinds = ["RECEIPT", "CUT", "TAILOR_SEND", "TAILOR_RETURN", "TRANSFER"] as const;
    const flowMonths = [...new Set(prod.map((p) => p.month))].sort();
    const flow = flowMonths.map((m) => ({
      month: m,
      ...Object.fromEntries(
        flowKinds.map((k) => {
          const r = prod.find((p) => p.month === m && p.kind === k);
          return [k, { events: r?.events ?? 0, qty: r?.qtyIn ?? 0 }];
        }),
      ),
    }));

    return {
      generatedAt: new Date(),
      period: { from: h.firstSale, to: h.lastSale },
      totals: {
        revenue: totalRevenue,
        orders: totalOrders,
        avgOrder: totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0,
        collected: totalCollected,
        walkinRevenue,
        accountRevenue,
        saleDays: h.saleDays,
        revenuePerDay: h.saleDays > 0 ? Math.round(totalRevenue / h.saleDays) : 0,
      },
      monthly,
      weekly: weeks.map((w) => ({ week: w.week, orders: w.orders, revenue: w.revenue })),
      weekdays: dows,
      products: products.slice(0, 15),
      productCount: products.length,
      nonCatalog: manual[0] ?? { lines: 0, revenue: 0 },
      profit: {
        costedRevenue,
        costedShare: totalRevenue > 0 ? costedRevenue / totalRevenue : 0,
        grossProfit,
        marginPct: costedRevenue > 0 ? grossProfit / costedRevenue : null,
        expenseTotal: h.expenseTotal,
        expenses: h.expenses,
        tailorCharged: h.tailorCharged,
      },
      customers: {
        total: live.length,
        buyers: buyers.length,
        active30: active(30),
        active90: active(90),
        oneOrder: buyers.filter((c) => c.orders === 1).length,
        top1Share: topShare(1),
        top5Share: topShare(5),
        top20Share: topShare(20),
        top: buyers.slice(0, 10).map((c) => ({
          id: c.id, name: c.name, orders: c.orders, revenue: c.revenue, balance: c.balance, lastSale: c.lastSale,
        })),
      },
      receivables: {
        total: receivable,
        debtors: debtors.length,
        top1Share: receivable > 0 && debtors[0] ? debtors[0].balance / receivable : 0,
        aging: {
          d0_30: bucket(0, 31),
          d31_60: bucket(31, 61),
          d61_90: bucket(61, 91),
          d90plus: bucket(91, Infinity),
        },
        top: debtors.slice(0, 12).map((c) => ({
          id: c.id, name: c.name, balance: c.balance, lastSale: c.lastSale, lastPayment: c.lastPayment,
          daysSincePayment: c.daysSincePayment,
        })),
        inCredit: { count: inCredit.length, amount: -inCredit.reduce((s, c) => s + c.balance, 0) },
        // Debt that left the lists because the customer was deleted.
        deleted: {
          customers: gone.length,
          revenue: gone.reduce((s, c) => s + c.revenue, 0),
          unpaidCount: gone.filter((c) => c.balance > 0).length,
          unpaid: gone.filter((c) => c.balance > 0).reduce((s, c) => s + c.balance, 0),
        },
      },
      payments: { mix },
      payables: {
        supplierOrdered: h.supplierOrdered,
        supplierPaid: h.supplierPaid,
        supplierOwed: h.supplierOrdered - h.supplierPaid,
        tailorCharged: h.tailorCharged,
        tailorPaid: h.tailorPaid,
        tailorOwed: h.tailorCharged - h.tailorPaid,
      },
      stock: {
        totals: stock.totals,
        idle: idleStock.slice(0, 10),
        idleValue: idleStock.reduce((s, r) => s + r.value, 0),
        negative: negativeStock,
      },
      flow,
      hygiene: {
        sales: h.sales,
        voidedSales: h.voidedSales,
        saleDays: h.saleDays,
        closedSaleDays: h.closedSaleDays,
        closes: h.closes,
        closesOff: h.closesOff,
        closeDiff: h.closeDiff,
        openExceptions: h.openExceptions,
        expenses: h.expenses,
        returns: h.returns,
        returnTotal: h.returnTotal,
        refundTotal: h.refundTotal,
        uncostedItems: stock.totals.uncostedCount,
      },
    };
  }
}
