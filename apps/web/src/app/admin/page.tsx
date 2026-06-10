import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { DashboardSummary, StockRow } from "@/lib/api-client";
import { PageHeader, Card } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { SalesExpenseBars, ExpenseBreakdownPie } from "@/components/admin/dashboard-charts";

export const dynamic = "force-dynamic";

const EMPTY: DashboardSummary = {
  counts: { itemTypes: 0, customers: 0, suppliers: 0, tailors: 0 },
  today: { receivedTotal: 0, expectedCash: 0 },
  debts: { customer: 0, supplier: 0 },
  trend: [],
  expenseBreakdown: [],
  rangeSalesTotal: 0,
  rangeExpenseTotal: 0,
  returnsTotal: 0,
  netSales: 0,
  moneyIn: 0,
  moneyOut: 0,
  warehouseStock: [],
  shopStock: [],
  rollOrders: { openOrders: 0, rollsOrdered: 0, rollsReceived: 0, committedToPay: 0, dueNow: 0 },
};

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();

  // One server-aggregated call instead of ~9 round-trips. Shallow-merge over
  // EMPTY so a response missing a newer field (e.g. rollOrders, before the API
  // redeploys) falls back to a default instead of crashing the page.
  const fetched = await serverFetch<DashboardSummary>(`/api/dashboard/summary${qs ? `?${qs}` : ""}`);
  const summary: DashboardSummary = { ...EMPTY, ...(fetched ?? {}) };

  const trend = summary.trend.map((t) => ({
    date: t.date.slice(5),
    sales: t.sales,
    expenses: t.expenses,
  }));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={labels.admin.dashboard} />

      <DateFilter />

      {/* ── Selected period: the only section the date filter changes ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.dash.selectedPeriod}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <KpiCard label={labels.dash.netSales} value={formatKyat(summary.netSales)} />
          <KpiCard
            label={labels.dash.returns}
            value={formatKyat(summary.returnsTotal)}
            tone={summary.returnsTotal > 0 ? "warn" : "default"}
          />
          <KpiCard label={labels.dash.operatingExpenses} value={formatKyat(summary.rangeExpenseTotal)} />
          <KpiCard label={labels.dash.moneyIn} value={formatKyat(summary.moneyIn)} />
          <KpiCard
            label={labels.dash.moneyOut}
            value={formatKyat(summary.moneyOut)}
            tone={summary.moneyOut > 0 ? "warn" : "default"}
          />
          <KpiCard label={labels.dash.grossSales} value={formatKyat(summary.rangeSalesTotal)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">
              {labels.salesAdmin.title} / {labels.expenses.title}
            </h3>
            <SalesExpenseBars data={trend} />
          </Card>
          <Card className="p-4">
            <h3 className="mb-2 text-sm font-semibold">{labels.expenses.title}</h3>
            <ExpenseBreakdownPie data={summary.expenseBreakdown} />
          </Card>
        </div>
      </section>

      {/* ── Today's cash drawer (physical CASH only) — a glance; actual count
          + reconciliation happens on the Daily close page. ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            {labels.close.today}
          </h2>
          <Link href="/admin/closes" className="text-xs text-muted-foreground hover:underline">
            {labels.admin.closes} →
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard label={labels.dash.cashReceivedToday} value={formatKyat(summary.today.receivedTotal)} />
          <KpiCard label={labels.dash.expectedCashToday} value={formatKyat(summary.today.expectedCash)} />
        </div>
      </section>

      {/* ── Right now: current balances/stock — not affected by the filter ── */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {labels.dash.now}
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <KpiCard
            label={labels.domain.customer + " " + labels.domain.debt}
            value={formatKyat(summary.debts.customer)}
            tone={summary.debts.customer > 0 ? "warn" : "default"}
          />
          <KpiCard
            label={labels.domain.supplier + " " + labels.domain.debt}
            value={formatKyat(summary.debts.supplier)}
            tone={summary.debts.supplier > 0 ? "warn" : "default"}
          />
        </div>

        <Link href="/admin/supplier-orders" className="rounded-2xl border bg-card p-4 hover:bg-accent">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold">{labels.rollOrders.title}</h3>
            <span className="text-sm text-muted-foreground">→</span>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">{labels.rollOrders.open}</p>
              <p className="text-2xl font-bold tabular-nums">{summary.rollOrders.openOrders}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{labels.rollOrders.rolls}</p>
              <p className="text-2xl font-bold tabular-nums">
                {summary.rollOrders.rollsReceived}/{summary.rollOrders.rollsOrdered}
              </p>
              <p className="text-[11px] text-muted-foreground">{labels.rollOrders.received}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{labels.rollOrders.committedToPay}</p>
              <p className={"text-xl font-bold " + (summary.rollOrders.committedToPay > 0 ? "text-rose-600" : "")}>
                {formatKyat(summary.rollOrders.committedToPay)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{labels.rollOrders.dueNow}</p>
              <p className={"text-xl font-bold " + (summary.rollOrders.dueNow > 0 ? "text-rose-600" : "")}>
                {formatKyat(summary.rollOrders.dueNow)}
              </p>
            </div>
          </div>
        </Link>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <CountCard href="/admin/item-types" title={labels.admin.itemTypes} count={summary.counts.itemTypes} />
          <CountCard href="/admin/customers" title={labels.admin.customers} count={summary.counts.customers} />
          <CountCard href="/admin/suppliers" title={labels.admin.suppliers} count={summary.counts.suppliers} />
          <CountCard href="/admin/tailors" title={labels.admin.tailors} count={summary.counts.tailors} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <StockSection title={labels.transfer.locWarehouse} rows={summary.warehouseStock} />
          <StockSection title={labels.transfer.locShop} rows={summary.shopStock} />
        </div>
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"mt-1 text-2xl font-bold " + (tone === "warn" ? "text-rose-600" : "")}>
        {value}
      </p>
    </div>
  );
}

function CountCard({
  href,
  title,
  count,
}: {
  href: string;
  title: string;
  count: number | null;
}) {
  return (
    <Link href={href} className="flex flex-col gap-1 rounded-2xl border bg-card p-5 hover:bg-accent">
      <span className="text-sm text-muted-foreground">{title}</span>
      <span className="text-3xl font-bold">{count ?? "—"}</span>
    </Link>
  );
}

function StockSection({ title, rows }: { title: string; rows: StockRow[] }) {
  const nonZero = rows.filter((r) => r.qty !== 0);
  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      {nonZero.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{labels.common.noData}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {nonZero.map((r) => (
            <li key={r.itemTypeId} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2">
                {r.emoji && <span className="text-xl">{r.emoji}</span>}
                <span>{r.labelMy}</span>
              </span>
              <span className="text-lg font-bold tabular-nums">{r.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
