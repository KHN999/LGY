import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { PaymentHistory } from "@/lib/api-client";
import { SalesDateFilter } from "../../sales/sales-date-filter";

export const dynamic = "force-dynamic";

export default async function ReceivedHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; linked?: string }>;
}) {
  const { date, linked } = await searchParams;
  const params = new URLSearchParams({ limit: "200" });
  if (date) {
    params.set("fromDate", new Date(`${date}T00:00:00.000+06:30`).toISOString());
    params.set("toDate", new Date(`${date}T23:59:59.999+06:30`).toISOString());
  }
  if (linked === "account" || linked === "sale") params.set("linked", linked);
  const data = await serverFetch<PaymentHistory>(`/api/customer-payments?${params.toString()}`);
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0; // true total over the range, not just the shown rows

  const FILTERS: Array<{ key?: "account" | "sale"; label: string }> = [
    { label: labels.salesAdmin.filterAll },
    { key: "account", label: labels.receive.filterDebt },
    { key: "sale", label: labels.receive.filterOnSale },
  ];
  const filterHref = (key?: "account" | "sale") => {
    const p = new URLSearchParams();
    if (date) p.set("date", date);
    if (key) p.set("linked", key);
    const qs = p.toString();
    return qs ? `/staff/receive/history?${qs}` : "/staff/receive/history";
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 sm:p-6">
      <Link href="/staff/receive" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.common.back}
      </Link>
      <h1 className="text-xl font-bold">{labels.receive.historyTitle}</h1>
      <SalesDateFilter />

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (f.key ?? undefined) === (linked ?? undefined);
          return (
            <Link
              key={f.label}
              href={filterHref(f.key)}
              className={
                "rounded-lg px-3 py-1.5 text-sm " +
                (active ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {rows.length} · <span className="font-semibold text-emerald-700">{formatKyat(total)}</span>
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.receive.historyEmpty}
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((p) => {
            const href = p.saleId
              ? `/staff/sales/${p.saleId}`
              : p.customerId
                ? `/staff/customers/${p.customerId}`
                : undefined;
            const inner = (
              <>
                <div className="min-w-0">
                  <p className="font-semibold">{p.customerName ?? labels.sell.walkInCustomer}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(p.paymentDate)} ·{" "}
                    {p.method === "BANK_TRANSFER"
                      ? labels.paymentReceipt.methodBank
                      : labels.paymentReceipt.methodCash}
                    {p.saleId ? ` · #${p.saleId}` : ""}
                  </p>
                </div>
                <span className="shrink-0 font-bold tabular-nums text-emerald-700">
                  {formatKyat(p.amount)}
                </span>
              </>
            );
            return (
              <li key={p.id}>
                {href ? (
                  <Link
                    href={href}
                    className="flex items-center justify-between gap-3 p-4 hover:bg-accent active:scale-[0.99]"
                  >
                    {inner}
                  </Link>
                ) : (
                  <div className="flex items-center justify-between gap-3 p-4">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
