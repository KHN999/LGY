import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { SupplierOrder } from "@/lib/api-client";

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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{labels.admin.supplierOrders}</h1>
        <Link
          href="/admin/supplier-orders/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          + {labels.common.addNew}
        </Link>
      </div>

      {params.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.admin.empty.supplierOrders}
        </div>
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
                      {new Date(o.orderDate).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatKyat(totalActual)}
                    </p>
                    {remainingPay > 0 && (
                      <p className="text-xs text-rose-600">
                        ပေးရန်ကျန်: {formatKyat(remainingPay)}
                      </p>
                    )}
                    {remainingPay < 0 && (
                      <p className="text-xs text-emerald-600">
                        ကျော်ပေး: {formatKyat(-remainingPay)}
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
