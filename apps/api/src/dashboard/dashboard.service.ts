import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DailyCloseService } from "../daily-close/daily-close.service";
import { InventoryService } from "../inventory/inventory.service";
import { CustomersService } from "../customers/customers.service";
import { SuppliersService } from "../suppliers/suppliers.service";
import { SupplierOrdersService, type RollOrdersSummary } from "../supplier-orders/supplier-orders.service";
import { addDays, toYangonYmd, ymdToYangonStart } from "../common/yangon-time";

export interface DashboardStockRow {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  qty: number;
}

export interface DashboardSummary {
  counts: { itemTypes: number; customers: number; suppliers: number; tailors: number };
  /** "Today" physical cash drawer (CASH method only — see DailyCloseService). */
  today: { receivedTotal: number; expectedCash: number };
  /** "Right now" — current balances, not affected by the date filter. */
  debts: { customer: number; supplier: number };
  trend: { date: string; sales: number; expenses: number }[];
  expenseBreakdown: { name: string; value: number }[];
  // ── Selected-period figures (respond to the date filter) ──
  /** Gross sales (Σ grandTotal of non-voided sales in range). */
  rangeSalesTotal: number;
  /** Operating expenses (Σ Expense.amount in range) — not all money out. */
  rangeExpenseTotal: number;
  /** Σ SaleReturn.returnTotal in range. */
  returnsTotal: number;
  /** Gross sales − returns. */
  netSales: number;
  /** All money received in range (customer payments, every method). */
  moneyIn: number;
  /** All money paid out in range: supplier + tailor payments + expenses + refunds. */
  moneyOut: number;
  /** Total pieces sold per item type over the selected period (ranked, biggest first). */
  itemsSold: { itemTypeId: number | null; label: string; emoji: string | null; qty: number }[];
  warehouseStock: DashboardStockRow[];
  shopStock: DashboardStockRow[];
  rollOrders: RollOrdersSummary;
}

/**
 * One shop-scoped aggregation for the admin dashboard, so the page makes a single
 * server-side call instead of ~9 round-trips. Also fixes the old caps: customer/
 * supplier debt and range sales total are now summed over ALL rows (the page used
 * to cap at limit=200 customers / limit=1000 sales, silently wrong at scale).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dailyClose: DailyCloseService,
    private readonly inventory: InventoryService,
    private readonly customers: CustomersService,
    private readonly suppliers: SuppliersService,
    private readonly supplierOrders: SupplierOrdersService,
  ) {}

  async summary(range: { from?: string; to?: string } = {}): Promise<DashboardSummary> {
    // The DateFilter sends a Yangon-anchored, end-of-day ISO instant for `to`; a
    // bare YYYY-MM-DD means "through the end of that day". Both must include the
    // whole to-day, so a bare date uses an exclusive next-day upper bound.
    const upper = (to: string) =>
      to.includes("T") ? { lte: new Date(to) } : { lt: addDays(new Date(to), 1) };
    const dateFilter = (col: string) =>
      range.from || range.to
        ? {
            [col]: {
              ...(range.from ? { gte: new Date(range.from) } : {}),
              ...(range.to ? upper(range.to) : {}),
            },
          }
        : {};

    const [
      itemTypeCount,
      customerCount,
      supplierCount,
      tailorCount,
      today,
      custIds,
      suppIds,
      whMap,
      shopMap,
      itemTypes,
      salesRows,
      expenseRows,
      returnsAgg,
      moneyInAgg,
      supplierPaidAgg,
      tailorPaidAgg,
    ] = await Promise.all([
      this.prisma.itemType.count({ where: { isActive: true } }),
      this.prisma.customer.count({ where: { status: "ACTIVE" } }),
      this.prisma.supplier.count({ where: { status: "ACTIVE" } }),
      this.prisma.tailor.count({ where: { status: "ACTIVE" } }),
      this.dailyClose.preview(),
      this.prisma.customer.findMany({ select: { id: true } }),
      this.prisma.supplier.findMany({ select: { id: true } }),
      this.inventory.stockMapAt("WAREHOUSE"),
      this.inventory.stockMapAt("SHOP"),
      this.prisma.itemType.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
      this.prisma.sale.findMany({
        where: { voidedAt: null, ...dateFilter("saleDate") },
        select: {
          saleDate: true,
          grandTotal: true,
          lines: {
            select: {
              itemTypeId: true,
              itemName: true,
              qty: true,
              itemType: { select: { labelMy: true, emoji: true } },
            },
          },
        },
      }),
      this.prisma.expense.findMany({
        where: { voidedAt: null, ...dateFilter("expenseDate") },
        select: { expenseDate: true, amount: true, category: { select: { labelMy: true } } },
      }),
      this.prisma.saleReturn.aggregate({
        _sum: { returnTotal: true, refundAmount: true },
        where: { voidedAt: null, ...dateFilter("returnDate") },
      }),
      this.prisma.customerPayment.aggregate({
        _sum: { amount: true },
        where: { voidedAt: null, ...dateFilter("paymentDate") },
      }),
      this.prisma.supplierPayment.aggregate({
        _sum: { amount: true },
        where: { voidedAt: null, ...dateFilter("paymentDate") },
      }),
      this.prisma.tailorPayment.aggregate({
        _sum: { amount: true },
        where: { voidedAt: null, ...dateFilter("paymentDate") },
      }),
    ]);

    const [custBalances, suppBalances, rollOrders] = await Promise.all([
      this.customers.balancesFor(custIds.map((c) => c.id)),
      this.suppliers.balancesFor(suppIds.map((s) => s.id)),
      this.supplierOrders.summary(),
    ]);
    const customerDebt = [...custBalances.values()].reduce((s, b) => s + Math.max(0, b), 0);
    const supplierDebt = [...suppBalances.values()].reduce((s, b) => s + Math.max(0, b), 0);

    // Bucket sales + expenses by Yangon business day for the trend chart.
    const dayMap = new Map<string, { sales: number; expenses: number }>();
    const bucket = (d: string) => {
      let v = dayMap.get(d);
      if (!v) {
        v = { sales: 0, expenses: 0 };
        dayMap.set(d, v);
      }
      return v;
    };
    let rangeSalesTotal = 0;
    let rangeExpenseTotal = 0;
    // Total pieces sold per item type over the range. Keyed by item-type id, or by
    // the free-text name for ad-hoc (non-catalog) lines.
    type SoldItem = { itemTypeId: number | null; label: string; emoji: string | null; qty: number };
    const itemsMap = new Map<string, SoldItem>();
    for (const s of salesRows) {
      bucket(toYangonYmd(s.saleDate)).sales += s.grandTotal;
      rangeSalesTotal += s.grandTotal;
      for (const l of s.lines) {
        const key = l.itemTypeId != null ? `t${l.itemTypeId}` : `n:${l.itemName ?? "—"}`;
        const existing = itemsMap.get(key);
        if (existing) {
          existing.qty += l.qty;
        } else {
          itemsMap.set(key, {
            itemTypeId: l.itemTypeId,
            label: l.itemType?.labelMy ?? l.itemName ?? "—",
            emoji: l.itemType?.emoji ?? null,
            qty: l.qty,
          });
        }
      }
    }
    const catMap = new Map<string, number>();
    for (const e of expenseRows) {
      bucket(toYangonYmd(e.expenseDate)).expenses += e.amount;
      rangeExpenseTotal += e.amount;
      const name = e.category?.labelMy ?? "—";
      catMap.set(name, (catMap.get(name) ?? 0) + e.amount);
    }
    // Zero-fill every Yangon day across the selected range so the chart has no
    // gaps (a weekly/monthly view used to drop empty days).
    if (range.from && range.to) {
      const endYmd = toYangonYmd(new Date(range.to));
      let d = ymdToYangonStart(toYangonYmd(new Date(range.from)));
      for (let i = 0; i < 400 && toYangonYmd(d) <= endYmd; i++) {
        bucket(toYangonYmd(d));
        d = addDays(d, 1);
      }
    }
    const trend = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, sales: v.sales, expenses: v.expenses }));
    const expenseBreakdown = [...catMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    // Best-selling item first.
    const itemsSold = [...itemsMap.values()].sort((a, b) => b.qty - a.qty);

    const returnsTotal = returnsAgg._sum.returnTotal ?? 0;
    const refundsTotal = returnsAgg._sum.refundAmount ?? 0;
    const moneyIn = moneyInAgg._sum.amount ?? 0;
    const moneyOut =
      (supplierPaidAgg._sum.amount ?? 0) +
      (tailorPaidAgg._sum.amount ?? 0) +
      rangeExpenseTotal +
      refundsTotal;

    const rows = (map: Map<number, number>): DashboardStockRow[] =>
      itemTypes.map((t) => ({
        itemTypeId: t.id,
        key: t.key,
        labelMy: t.labelMy,
        emoji: t.emoji,
        qty: map.get(t.id) ?? 0,
      }));

    return {
      counts: {
        itemTypes: itemTypeCount,
        customers: customerCount,
        suppliers: supplierCount,
        tailors: tailorCount,
      },
      today: { receivedTotal: today.receivedTotal, expectedCash: today.expectedCash },
      debts: { customer: customerDebt, supplier: supplierDebt },
      trend,
      expenseBreakdown,
      rangeSalesTotal,
      rangeExpenseTotal,
      returnsTotal,
      netSales: rangeSalesTotal - returnsTotal,
      moneyIn,
      moneyOut,
      itemsSold,
      warehouseStock: rows(whMap),
      shopStock: rows(shopMap),
      rollOrders,
    };
  }
}
