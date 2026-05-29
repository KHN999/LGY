import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { SupplierOrder } from "@/lib/api-client";
import { OrderDetail } from "./order-detail";

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

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const order = await serverFetch<SupplierOrder>(`/api/supplier-orders/${id}`);
  if (!order) notFound();

  const received = order.receipts.reduce((s, r) => s + r.receivedQty, 0);
  const remaining = Math.max(0, order.expectedQty - received);
  const totalActual =
    order.receipts.reduce(
      (s, r) => s + r.goodsCost + r.transportCost,
      0,
    ) || order.expectedTotal;
  const paid = order.payments.reduce((s, p) => s + p.amount, 0);
  const remainingPay = totalActual - paid;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/supplier-orders"
        className="text-sm text-muted-foreground hover:underline"
      >
        ← {labels.admin.supplierOrders}
      </Link>

      {sp.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{order.supplier?.name}</h1>
          <span className={"rounded px-2 py-0.5 text-xs " + STATUS_TONE[order.status]}>
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {order.itemType?.emoji} {order.itemType?.labelMy} ·{" "}
          {new Date(order.orderDate).toLocaleDateString("en-US")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={labels.admin.order.expectedQty} value={String(order.expectedQty)} />
        <Stat label={labels.admin.order.receivedQty} value={String(received)} tone="emerald" />
        <Stat label={labels.admin.order.remainingQty} value={String(remaining)} tone="amber" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={labels.admin.order.totalExpected} value={formatKyat(totalActual)} />
        <Stat label={labels.admin.order.paid} value={formatKyat(paid)} tone="emerald" />
        <Stat
          label={labels.admin.order.remaining}
          value={formatKyat(remainingPay)}
          tone={remainingPay > 0 ? "rose" : remainingPay < 0 ? "emerald" : undefined}
        />
      </div>

      <OrderDetail order={order} />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "rose" | "emerald" | "amber";
}) {
  const cls =
    tone === "rose"
      ? "text-rose-600"
      : tone === "emerald"
        ? "text-emerald-600"
        : tone === "amber"
          ? "text-amber-700"
          : "";
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-bold " + cls}>{value}</p>
    </div>
  );
}
