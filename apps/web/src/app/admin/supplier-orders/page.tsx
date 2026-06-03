import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";
import type { SupplierOrder } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<SupplierOrder["status"], string> = {
  PENDING: labels.admin.order.pending,
  PARTIAL_RECEIVED: labels.admin.order.partialReceived,
  RECEIVED: labels.admin.order.received,
  CANCELLED: labels.admin.order.cancelled,
};

const STATUS_TONE: Record<SupplierOrder["status"], string> = {
  PENDING: "bg-amber-100 text-amber-900",
  PARTIAL_RECEIVED: "bg-sky-100 text-sky-900",
  RECEIVED: "bg-emerald-100 text-emerald-900",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function SupplierOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const orders = await serverFetch<SupplierOrder[]>("/api/supplier-orders");
  const rows = orders ?? [];

  // Header totals — same per-row formula as below, so they always agree.
  const totals = rows.reduce(
    (acc, o) => {
      const received = o.receipts.reduce((s, r) => s + r.receivedQty, 0);
      const paid = o.payments.reduce((s, p) => s + p.amount, 0);
      const receivedCost = o.receipts.reduce((s, r) => s + r.goodsCost + r.transportCost, 0);
      const totalActual = receivedCost || o.expectedTotal;
      acc.committed += Math.max(0, totalActual - paid);
      acc.dueNow += Math.max(0, receivedCost - paid);
      if (o.status === "PENDING" || o.status === "PARTIAL_RECEIVED") {
        acc.open += 1;
        acc.rollsOrdered += o.expectedQty;
        acc.rollsReceived += received;
      }
      return acc;
    },
    { open: 0, rollsOrdered: 0, rollsReceived: 0, committed: 0, dueNow: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.supplierOrders}
        action={
          <Link href="/admin/supplier-orders/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />

      {params.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">{labels.rollOrders.open}</p>
            <p className="text-xl font-bold tabular-nums">{totals.open}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.rollOrders.rolls}</p>
            <p className="text-xl font-bold tabular-nums">
              {totals.rollsReceived}/{totals.rollsOrdered}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.rollOrders.committedToPay}</p>
            <p className={"text-lg font-bold " + (totals.committed > 0 ? "text-rose-600" : "")}>
              {formatKyat(totals.committed)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.rollOrders.dueNow}</p>
            <p className={"text-lg font-bold " + (totals.dueNow > 0 ? "text-rose-600" : "")}>
              {formatKyat(totals.dueNow)}
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.supplierOrders}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((o) => {
            const received = o.receipts.reduce((s, r) => s + r.receivedQty, 0);
            const paid = o.payments.reduce((s, p) => s + p.amount, 0);
            const totalActual =
              o.receipts.reduce(
                (s, r) => s + r.goodsCost + r.transportCost,
                0,
              ) ||
              o.expectedTotal;
            const remainingPay = totalActual - paid;
            return (
              <li key={o.id}>
                <Link
                  href={`/admin/supplier-orders/${o.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{o.supplier?.name}</span>
                      <span
                        className={
                          "rounded px-2 py-0.5 text-xs " + STATUS_TONE[o.status]
                        }
                      >
                        {STATUS_LABEL[o.status]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {o.itemType?.emoji} {o.itemType?.labelMy} ×{" "}
                      <span className="font-medium">{received}</span> / {o.expectedQty}
                      {" · "}
                      {formatDate(o.orderDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">
                      {formatKyat(totalActual)}
                    </p>
                    {remainingPay > 0 && (
                      <p className="text-sm text-rose-600">
                        {labels.admin.order.remaining}: {formatKyat(remainingPay)}
                      </p>
                    )}
                    {remainingPay < 0 && (
                      <p className="text-sm text-emerald-600">
                        {labels.admin.order.overpaid}: {formatKyat(-remainingPay)}
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
