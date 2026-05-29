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
} from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const [
    customers,
    suppliers,
    tailors,
    itemTypes,
    warehouseStock,
    shopStock,
    todayPreview,
  ] = await Promise.all([
    serverFetch<Page<Customer>>("/api/customers?limit=200"),
    serverFetch<Page<Supplier>>("/api/suppliers?limit=200"),
    serverFetch<Page<Tailor>>("/api/tailors?limit=200"),
    serverFetch<ItemType[]>("/api/item-types"),
    serverFetch<StockRow[]>("/api/inventory/stock?location=WAREHOUSE"),
    serverFetch<StockRow[]>("/api/inventory/stock?location=SHOP"),
    serverFetch<DailyClosePreview>("/api/daily-close/preview"),
  ]);

  const customerDebt = (customers?.data ?? []).reduce(
    (s, c) => s + Math.max(0, c.balance),
    0,
  );
  const supplierDebt = (suppliers?.data ?? []).reduce(
    (s, x) => s + Math.max(0, x.balance),
    0,
  );

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{labels.admin.dashboard}</h1>

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
