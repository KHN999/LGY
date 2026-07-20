import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { StockValuation } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InventoryValuePage() {
  const data = await serverFetch<StockValuation>("/api/inventory/value");
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
