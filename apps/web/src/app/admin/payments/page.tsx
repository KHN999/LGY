import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { bankLabel } from "@/lib/banks";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime, yangonYmd } from "@/lib/utils";
import type { PaymentHistory } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { VoidPaymentButton } from "./void-payment-button";
import { SwitchMethodButton } from "./switch-method-button";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; range?: string; linked?: string; channel?: string }>;
}) {
  const { from, to, range, linked, channel } = await searchParams;
  const params = new URLSearchParams({ limit: "200" });
  if (from) params.set("fromDate", from);
  if (to) params.set("toDate", to);
  if (linked === "account" || linked === "sale") params.set("linked", linked);
  if (channel && /^[A-Z]+$/.test(channel)) params.set("channel", channel);
  const [data, closes] = await Promise.all([
    serverFetch<PaymentHistory>(`/api/customer-payments?${params.toString()}`),
    // Days whose cash is already closed — switching a payment on one gets a warning.
    serverFetch<{ date: string }[]>(`/api/daily-close`),
  ]);
  const closedDays = new Set((closes ?? []).map((c) => c.date));
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0; // true total over the whole range, not just the shown rows
  const count = data?.count ?? rows.length;
  const breakdown = data?.breakdown ?? [];
  const allTotal = breakdown.reduce((s, b) => s + b.total, 0);
  const allCount = breakdown.reduce((s, b) => s + b.count, 0);
  const channelLabel = (b: { channel: string; method: string }) =>
    b.channel === "CASH"
      ? `💵 ${labels.paymentReceipt.methodCash}`
      : b.channel === "NOBANK"
        ? `🏦 ${labels.receive.bankNotRecorded}`
        : b.method === "BANK_TRANSFER"
          ? `🏦 ${bankLabel(b.channel)}`
          : b.method;

  const FILTERS: Array<{ key?: "account" | "sale"; label: string }> = [
    { label: labels.salesAdmin.filterAll },
    { key: "account", label: labels.receive.filterDebt },
    { key: "sale", label: labels.receive.filterOnSale },
  ];
  const filterHref = (key?: "account" | "sale", ch: string | undefined = channel) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (range) p.set("range", range);
    if (key) p.set("linked", key);
    if (ch) p.set("channel", ch);
    const qs = p.toString();
    return qs ? `/admin/payments?${qs}` : "/admin/payments";
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.payments} />

      <DateFilter />

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

      {breakdown.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold">{labels.receive.byChannel}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {[
              { channel: "", method: "", label: labels.salesAdmin.filterAll, count: allCount, total: allTotal },
              ...breakdown.map((b) => ({ ...b, label: channelLabel(b) })),
            ].map((b) => {
              const active = (b.channel || undefined) === (channel || undefined);
              const lk = linked === "account" || linked === "sale" ? linked : undefined;
              return (
                <Link
                  key={b.channel || "all"}
                  href={filterHref(lk, b.channel || undefined)}
                  aria-current={active ? "true" : undefined}
                  className={
                    "flex flex-col gap-1 rounded-2xl border p-3 " +
                    (active ? "border-2 border-emerald-500 bg-emerald-50" : "bg-card hover:bg-accent")
                  }
                >
                  <span className="text-sm font-semibold">{b.label}</span>
                  <span className="text-lg font-bold tabular-nums">{formatKyat(b.total)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {b.count.toLocaleString("en-US")} {labels.receive.times}
                    {b.channel && allTotal > 0 ? ` · ${Math.round((b.total / allTotal) * 100)}%` : ""}
                  </span>
                  {b.channel && (
                    <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-emerald-500"
                        style={{ width: `${allTotal > 0 ? (b.total / allTotal) * 100 : 0}%` }}
                      />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">{labels.receive.channelHint}</p>
        </section>
      )}

      {rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {count.toLocaleString("en-US")} {labels.receive.times} ·{" "}
          <span className="font-semibold text-emerald-700">{formatKyat(total)}</span>
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState>{labels.receive.historyEmpty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((p) => {
            const href = p.saleId
              ? `/admin/sales/${p.saleId}`
              : p.customerId
                ? `/admin/customers/${p.customerId}`
                : undefined;
            const main = (
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{p.customerName ?? labels.salesAdmin.walkIn}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(p.paymentDate)} ·{" "}
                  {p.method === "BANK_TRANSFER"
                    ? `${labels.paymentReceipt.methodBank}${p.bank ? ` · ${bankLabel(p.bank)}` : ""}`
                    : labels.paymentReceipt.methodCash}
                  {p.saleId ? ` · #${p.saleId}` : ""}
                </p>
              </div>
            );
            return (
              <li key={p.id} className="flex items-center justify-between gap-3 p-4">
                {href ? (
                  <Link href={href} className="flex min-w-0 flex-1 items-center hover:underline">
                    {main}
                  </Link>
                ) : (
                  main
                )}
                <span className="shrink-0 font-bold tabular-nums text-emerald-700">
                  {formatKyat(p.amount)}
                </span>
                <SwitchMethodButton
                  id={p.id}
                  isBank={p.method !== "CASH"}
                  dayClosed={closedDays.has(yangonYmd(p.paymentDate))}
                />
                <VoidPaymentButton id={p.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
