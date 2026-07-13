import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { AuditLogRow, AuditEntityContext, ItemType } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

// Money-valued payload fields → shown as kyat. Everything else is a plain value.
const MONEY = new Set([
  "amount", "paidAmount", "unitPrice", "lineTotal", "expectedTotal", "goodsCost",
  "transportCost", "countedCash", "carryForward", "refundAmount", "discount",
  "grandTotal", "defaultFee", "defaultFeePerPiece", "monthlySalary", "feePerPiece",
  "openingCash",
]);
const LABEL: Record<string, string> = {
  kind: "Type", paidAmount: "Paid", paymentMethod: "Method", method: "Method",
  amount: "Amount", customerName: "Customer", customerId: "Customer", supplierId: "Supplier",
  expectedQty: "Quantity ordered", expectedTotal: "Order total", location: "Location",
  fromLocation: "From", toLocation: "To", categoryId: "Category", reason: "Reason",
  notes: "Note", discount: "Discount", refundAmount: "Refund", countedCash: "Counted cash",
  carryForward: "Carry forward", date: "Date", status: "Status", name: "Name",
  contact: "Contact", defaultKind: "Default type", paidTo: "Paid to", driverName: "Driver",
  driverFee: "Driver fee", saleId: "Sale", shop: "Shop",
};
const ENUM: Record<string, string> = {
  RETAIL: "Retail", WHOLESALE: "Wholesale", CASH: "Cash", BANK_TRANSFER: "Bank transfer",
  MOBILE_MONEY: "Mobile money", OTHER: "Other", WAREHOUSE: "Warehouse", SHOP: "Shop",
  IN_TRANSIT: "In transit", main: "Main shop", playground: "Test shop",
};
// Internal/technical fields we never show.
const HIDE = new Set(["items", "counts", "itemTypeId", "itemName", "saveCustomer"]);

const friendly = (v: unknown): string => (typeof v === "string" && ENUM[v]) || String(v);
const humanize = (k: string) =>
  LABEL[k] ?? k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, itemTypes, context] = await Promise.all([
    serverFetch<AuditLogRow>(`/api/audit/${id}`),
    serverFetch<ItemType[]>(`/api/item-types`),
    serverFetch<AuditEntityContext | null>(`/api/audit/${id}/context`).catch(() => null),
  ]);

  if (!row) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/admin/audit" className="self-start rounded-lg border px-4 py-2 text-sm hover:bg-accent">
          ← Audit log
        </Link>
        <EmptyState>Not found.</EmptyState>
      </div>
    );
  }

  const names = new Map((itemTypes ?? []).map((t) => [t.id, t.labelMy]));
  const itemName = (i: Record<string, unknown>): string =>
    (i.itemTypeId != null && names.get(Number(i.itemTypeId))) ||
    (typeof i.itemName === "string" && i.itemName) ||
    `#${String(i.itemTypeId ?? "?")}`;

  const p = (row.payload && typeof row.payload === "object" ? row.payload : {}) as Record<string, unknown>;
  const lines = Array.isArray(p.items) ? p.items : Array.isArray(p.counts) ? p.counts : [];
  // Top-level scalar fields (skip arrays + internal keys + empties).
  const fields = Object.entries(p).filter(
    ([k, v]) => !HIDE.has(k) && v !== null && v !== undefined && v !== "" && typeof v !== "object",
  );

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/audit" className="self-start rounded-lg border px-4 py-2 text-sm hover:bg-accent">
        ← Audit log
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{row.summary ?? "Activity"}</h1>
        <span className={"rounded px-2 py-0.5 text-xs font-semibold " + (row.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900")}>
          {row.ok ? "OK" : "Failed"}
        </span>
        {row.shop === "playground" && (
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">Test</span>
        )}
      </div>
      <p className="-mt-2 text-sm text-muted-foreground">
        {row.username ?? "—"} · {formatDateTime(row.createdAt)}
      </p>

      {!row.ok && row.error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {row.error}
        </div>
      )}

      {context && context.kind === "stock-exception" && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-amber-900">Stock change</h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-medium">
              {context.item.emoji ? `${context.item.emoji} ` : ""}
              {context.item.name}
              <span className="text-muted-foreground"> · {friendly(context.location)}</span>
            </span>
            <span className="shrink-0 text-lg font-semibold tabular-nums">
              {context.recounted && context.before != null && context.after != null
                ? context.before === context.after
                  ? `confirmed at ${context.after.toLocaleString("en-US")} (no change)`
                  : `${context.before.toLocaleString("en-US")} → ${context.after.toLocaleString("en-US")}`
                : "Closed — no stock change"}
            </span>
          </div>
        </div>
      )}

      {(lines.length > 0 || fields.length > 0) && (
        <div className="rounded-2xl border bg-card p-4">
          {lines.length > 0 && (
            <ul className="flex flex-col divide-y">
              {(lines as Array<Record<string, unknown>>).map((i, idx) => {
                const qty = Number(i.qty ?? i.countedQty ?? 0);
                const price = i.unitPrice != null ? Number(i.unitPrice) : null;
                return (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-medium">{itemName(i)}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {i.countedQty != null && i.unitPrice == null
                        ? `→ ${qty}`
                        : price != null
                          ? `${qty} × ${price.toLocaleString("en-US")} = ${formatKyat(qty * price)}`
                          : `× ${qty}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {fields.length > 0 && (
            <dl className={"grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 " + (lines.length > 0 ? "mt-4 border-t pt-4" : "")}>
              {fields.map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{humanize(k)}</dt>
                  <dd className="break-words font-medium">
                    {MONEY.has(k) ? formatKyat(Number(v)) : /Id$/.test(k) ? `#${String(v)}` : friendly(v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
