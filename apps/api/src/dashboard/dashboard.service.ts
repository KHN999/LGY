import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DailyCloseService } from "../daily-close/daily-close.service";
import { InventoryService } from "../inventory/inventory.service";
import { CustomersService } from "../customers/customers.service";
import { SuppliersService } from "../suppliers/suppliers.service";
import { SupplierOrdersService, type RollOrdersSummary } from "../supplier-orders/supplier-orders.service";
import { toYangonYmd } from "../common/yangon-time";

export interface DashboardStockRow {
  itemTypeId: number;
  key: string;
  labelMy: string;
  emoji: string | null;
  qty: number;
}

export interface DashboardSummary {
  counts: { itemTypes: number; customers: number; suppliers: number; tailors: number };
  today: { receivedTotal: number; expectedCash: number };
  debts: { customer: number; supplier: number };
  trend: { date: string; sales: number; expenses: number }[];
  expenseBreakdown: { name: string; value: number }[];
  rangeSalesTotal: number;
  rangeExpenseTotal: number;
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
    const dateFilter = (col: "saleDate" | "expenseDate") =>
      range.from || range.to
        ? {
            [col]: {
              ...(range.from ? { gte: new Date(range.from) } : {}),
              ...(range.to ? { lte: new Date(range.to) } : {}),
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
    ] = await Promise.all([
      this.prisma.itemType.count(),
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
        select: { saleDate: true, grandTotal: true },
      }),
      this.prisma.expense.findMany({
        where: { voidedAt: null, ...dateFilter("expenseDate") },
        select: { expenseDate: true, amount: true, category: { select: { labelMy: true } } },
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
    for (const s of salesRows) {
      bucket(toYangonYmd(s.saleDate)).sales += s.grandTotal;
      rangeSalesTotal += s.grandTotal;
    }
    const catMap = new Map<string, number>();
    for (const e of expenseRows) {
      bucket(toYangonYmd(e.expenseDate)).expenses += e.amount;
      rangeExpenseTotal += e.amount;
      const name = e.category?.labelMy ?? "—";
      catMap.set(name, (catMap.get(name) ?? 0) + e.amount);
    }
    const trend = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date, sales: v.sales, expenses: v.expenses }));
    const expenseBreakdown = [...catMap.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

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
      warehouseStock: rows(whMap),
      shopStock: rows(shopMap),
      rollOrders,
    };
  }
}
