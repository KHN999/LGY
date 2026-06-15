import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";
import type { ItemSaleRow } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<ItemSaleRow["status"], string> = {
  UNPAID: labels.domain.statusUnpaid,
  PARTIAL: labels.domain.statusPartial,
  PAID: labels.domain.statusPaid,
};
const STATUS_TONE: Record<ItemSaleRow["status"], string> = {
  UNPAID: "bg-rose-100 text-rose-900",
  PARTIAL: "bg-amber-100 text-amber-900",
  PAID: "bg-emerald-100 text-emerald-900",
};

export default async function ItemSalesPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; from?: string; to?: string }>;
}) {
  const { name, from, to } = await searchParams;
  const apiParams = new URLSearchParams({ limit: "500" });
  if (name) apiParams.set("name", name);
  if (from) apiParams.set("fromDate", from);
  if (to) apiParams.set("toDate", to);
  const rows = (await serverFetch<ItemSaleRow[]>(`/api/sales/by-item?${apiParams.toString()}`)) ?? [];

  const totalQty = rows.reduce((s, r) => s + r.itemQty, 0);
  const period =
    from && to
      ? formatDate(from) === formatDate(to)
        ? formatDate(from)
        : `${formatDate(from)} – ${formatDate(to)}`
      : labels.filter.all;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin"
        backLabel={labels.admin.dashboard}
        title={name || labels.dash.itemReceipts}
        subtitle={`${labels.dash.itemReceipts} · ${period}`}
      />

      {rows.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {labels.dash.itemsSold}: <span className="font-semibold">{totalQty.toLocaleString("en-US")}</span>{" "}
          · {rows.length} {labels.salesAdmin.title}
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState>{labels.salesAdmin.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((s) => {
            const remaining = s.grandTotal - s.paidAmount;
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/sales/${s.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        #{s.id} {s.customerName ?? labels.salesAdmin.walkIn}
                      </span>
                      <span className={"rounded px-2 py-0.5 text-xs " + STATUS_TONE[s.status]}>
                        {STATUS_LABEL[s.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(s.saleDate)} · ×{s.itemQty} = {formatKyat(s.itemTotal)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{formatKyat(s.grandTotal)}</p>
                    {remaining > 0 && (
                      <p className="text-sm text-rose-600">
                        {labels.domain.remaining}: {formatKyat(remaining)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
