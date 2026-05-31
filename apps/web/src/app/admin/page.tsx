import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type {
  Page,
  Customer,
  Supplier,
  Tailor,
  ItemType,
  StockRow,
  DailyClosePreview,
  Sale,
  ExpenseRow,
} from "@/lib/api-client";
import { PageHeader, Card } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { SalesExpenseBars, ExpenseBreakdownPie } from "@/components/admin/dashboard-charts";

export const dynamic = "force-dynamic";

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const range = new URLSearchParams();
  if (from) range.set("from", from);
  if (to) range.set("to", to);
  const rangeQs = range.toString();
  const salesQs = new URLSearchParams({ limit: "1000" });
  if (from) salesQs.set("fromDate", from);
  if (to) salesQs.set("toDate", to);

  const [
    customers,
    suppliers,
    tailors,
    itemTypes,
    warehouseStock,
    shopStock,
    todayPreview,
    salesPage,
    expenses,
  ] = await Promise.all([
    serverFetch<Page<Customer>>("/api/customers?limit=200"),
    serverFetch<Page<Supplier>>("/api/suppliers?limit=200"),
    serverFetch<Page<Tailor>>("/api/tailors?limit=200"),
    serverFetch<ItemType[]>("/api/item-types"),
    serverFetch<StockRow[]>("/api/inventory/stock?location=WAREHOUSE"),
    serverFetch<StockRow[]>("/api/inventory/stock?location=SHOP"),
    serverFetch<DailyClosePreview>("/api/daily-close/preview"),
    serverFetch<Page<Sale>>(`/api/sales?${salesQs.toString()}`),
    serverFetch<ExpenseRow[]>(`/api/expenses${rangeQs ? `?${rangeQs}` : ""}`),
  ]);

  const customerDebt = (customers?.data ?? []).reduce(
    (s, c) => s + Math.max(0, c.balance),
    0,
  );
  const supplierDebt = (suppliers?.data ?? []).reduce(
    (s, x) => s + Math.max(0, x.balance),
    0,
  );

  // ── Aggregate for charts ──────────────────────────────────────────
  const dayMap = new Map<string, { sales: number; expenses: number }>();
  const bucket = (key: string) => dayMap.get(key) ?? dayMap.set(key, { sales: 0, expenses: 0 }).get(key)!;
  for (const s of salesPage?.data ?? []) {
    bucket(new Date(s.saleDate).toLocaleDateString("en-CA")).sales += s.grandTotal;
  }
  for (const e of expenses ?? []) {
    bucket(new Date(e.expenseDate).toLocaleDateString("en-CA")).expenses += e.amount;
  }
  const trend = [...dayMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => ({ date: d.slice(5), sales: v.sales, expenses: v.expenses }));

  const catMap = new Map<string, number>();
  for (const e of expenses ?? []) catMap.set(e.category.labelMy, (catMap.get(e.category.labelMy) ?? 0) + e.amount);
  const expenseBreakdown = [...catMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const rangeSalesTotal = (salesPage?.data ?? []).reduce((s, x) => s + x.grandTotal, 0);
  const rangeExpenseTotal = (expenses ?? []).reduce((s, x) => s + x.amount, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={labels.admin.dashboard} />

      <DateFilter />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={labels.close.received + " (" + labels.close.today + ")"}
          value={todayPreview ? formatKyat(todayPreview.receivedTotal) : "—"}
        />
        <KpiCard
          label={labels.close.expectedCash + " (" + labels.close.today + ")"}
          value={todayPreview ? formatKyat(todayPreview.expectedCash) : "—"}
        />
        <KpiCard
          label={labels.domain.customer + " " + labels.domain.debt}
          value={formatKyat(customerDebt)}
          tone={customerDebt > 0 ? "warn" : "default"}
        />
        <KpiCard
          label={labels.domain.supplier + " " + labels.domain.debt}
          value={formatKyat(supplierDebt)}
          tone={supplierDebt > 0 ? "warn" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {labels.salesAdmin.title} / {labels.expenses.title}
            </h2>
            <span className="text-xs text-muted-foreground">
              <span className="text-emerald-600">{formatKyat(rangeSalesTotal)}</span> ·{" "}
              <span className="text-rose-600">{formatKyat(rangeExpenseTotal)}</span>
            </span>
          </div>
          <SalesExpenseBars data={trend} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.expenses.title}</h2>
          <ExpenseBreakdownPie data={expenseBreakdown} />
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <CountCard href="/admin/item-types" title={labels.admin.itemTypes} count={itemTypes?.length ?? null} />
        <CountCard href="/admin/customers" title={labels.admin.customers} count={customers?.total ?? null} />
        <CountCard href="/admin/suppliers" title={labels.admin.suppliers} count={suppliers?.total ?? null} />
        <CountCard href="/admin/tailors" title={labels.admin.tailors} count={tailors?.total ?? null} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <StockSection title={labels.transfer.locWarehouse} rows={warehouseStock ?? []} />
        <StockSection title={labels.transfer.locShop} rows={shopStock ?? []} />
      </div>
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
