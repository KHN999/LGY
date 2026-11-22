import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatDate, formatKyat, yangonYmd } from "@/lib/utils";
import { PrintDocument, ValueControls } from "./value-controls";
import type { StockValuation } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryValuePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const today = yangonYmd(new Date());
  const { date: rawDate } = await searchParams;
  // Past days only; anything else (missing, malformed, future) means "now".
  const date = rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && rawDate < today ? rawDate : today;
  const isPast = date !== today;
  const dateLabel = formatDate(`${date}T12:00:00+06:30`);
  const data = await serverFetch<StockValuation>(
    isPast ? `/api/inventory/value?date=${date}` : "/api/inventory/value",
  );
  const items = data?.items ?? [];
  const totals = data?.totals ?? {
    warehouseValue: 0,
    shopValue: 0,
    totalValue: 0,
    uncostedCount: 0,
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.inventoryValue} />

      <ValueControls date={date} today={today} />

      <p className="text-sm text-muted-foreground">
        {labels.admin.valueAsOf}: <span className="font-semibold text-foreground">{dateLabel}</span>
        {isPast ? ` — ${labels.admin.valuePastNote}` : ""}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <ValueCard label={labels.transfer.locWarehouse} value={totals.warehouseValue} />
        <ValueCard label={labels.transfer.locShop} value={totals.shopValue} />
        <ValueCard label={labels.receipt.total} value={totals.totalValue} highlight />
      </div>

      {totals.uncostedCount > 0 && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
          {totals.uncostedCount} {labels.admin.uncostedItems}
        </p>
      )}

      {items.length === 0 ? (
        <EmptyState>{labels.common.noData}</EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="p-3">{labels.receipt.item}</th>
                <th className="p-3 text-right">{labels.transfer.locWarehouse}</th>
                <th className="p-3 text-right">{labels.transfer.locShop}</th>
                <th className="p-3 text-right">{labels.admin.costPrice}</th>
                <th className="p-3 text-right">{labels.admin.value}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((r) => (
                <tr key={r.itemTypeId}>
                  <td className="p-3 font-medium">
                    {r.emoji ? `${r.emoji} ` : ""}
                    {r.labelMy}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.warehouseQty.toLocaleString("en-US")}
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {r.shopQty.toLocaleString("en-US")}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted-foreground">
                    {r.costPrice != null ? r.costPrice.toLocaleString("en-US") : "—"}
                  </td>
                  <td className="p-3 text-right font-semibold tabular-nums">
                    {formatKyat(r.totalValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PrintDocument>
        <div className="bg-white text-black">
          <h1 className="text-base font-bold">{labels.admin.inventoryValue}</h1>
          <p className="text-xs">
            {labels.admin.valueAsOf}: {dateLabel}
          </p>
          <table className="mt-2 w-full text-[11px]">
            <thead>
              <tr className="border-b border-black text-left">
                <th className="py-1 pr-1">{labels.receipt.item}</th>
                <th className="px-1 py-1 text-right">{labels.transfer.locWarehouse}</th>
                <th className="px-1 py-1 text-right">{labels.transfer.locShop}</th>
                <th className="px-1 py-1 text-right">{labels.admin.costPrice}</th>
                <th className="py-1 pl-1 text-right">{labels.admin.value}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.itemTypeId} className="border-b border-neutral-300">
                  <td className="py-1 pr-1">{r.labelMy}</td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {r.warehouseQty.toLocaleString("en-US")}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {r.shopQty.toLocaleString("en-US")}
                  </td>
                  <td className="px-1 py-1 text-right tabular-nums">
                    {r.costPrice != null ? r.costPrice.toLocaleString("en-US") : "—"}
                  </td>
                  <td className="py-1 pl-1 text-right tabular-nums">
                    {r.totalValue.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="ml-auto mt-3 w-2/3 text-xs">
            <div className="flex justify-between">
              <dt>{labels.transfer.locWarehouse}</dt>
              <dd className="tabular-nums">{formatKyat(totals.warehouseValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{labels.transfer.locShop}</dt>
              <dd className="tabular-nums">{formatKyat(totals.shopValue)}</dd>
            </div>
            <div className="flex justify-between border-t border-black pt-1 text-sm font-bold">
              <dt>{labels.receipt.total}</dt>
              <dd className="tabular-nums">{formatKyat(totals.totalValue)}</dd>
            </div>
          </dl>
        </div>
      </PrintDocument>
    </div>
  );
}

function ValueCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={"rounded-2xl border p-4 " + (highlight ? "border-emerald-300 bg-emerald-50" : "bg-card")}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{formatKyat(value)}</p>
    </div>
  );
}
