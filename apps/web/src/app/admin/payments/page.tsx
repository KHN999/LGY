import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { ReceivedPaymentRow } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { VoidPaymentButton } from "./void-payment-button";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; range?: string }>;
}) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams({ limit: "200" });
  if (from) params.set("fromDate", from);
  if (to) params.set("toDate", to);
  const rows = (await serverFetch<ReceivedPaymentRow[]>(`/api/customer-payments?${params.toString()}`)) ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.payments} />

      <DateFilter />

      {rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {rows.length} ·{" "}
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
                    ? labels.paymentReceipt.methodBank
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
                <VoidPaymentButton id={p.id} />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
