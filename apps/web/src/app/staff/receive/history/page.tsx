import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { ReceivedPaymentRow } from "@/lib/api-client";
import { SalesDateFilter } from "../../sales/sales-date-filter";

export const dynamic = "force-dynamic";

export default async function ReceivedHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const params = new URLSearchParams({ limit: "200" });
  if (date) {
    params.set("fromDate", new Date(`${date}T00:00:00.000+06:30`).toISOString());
    params.set("toDate", new Date(`${date}T23:59:59.999+06:30`).toISOString());
  }
  const rows = (await serverFetch<ReceivedPaymentRow[]>(`/api/customer-payments?${params.toString()}`)) ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 sm:p-6">
      <Link href="/staff/receive" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.common.back}
      </Link>
      <h1 className="text-xl font-bold">{labels.receive.historyTitle}</h1>
      <SalesDateFilter />

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
