"use client";

import { useRouter } from "next/navigation";
import type { StockMovement, ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";

const LOC: Record<string, string> = {
  WAREHOUSE: labels.transfer.locWarehouse,
  SHOP: labels.transfer.locShop,
  IN_TRANSIT: labels.transfer.locInTransit,
  TAILOR: labels.movements.locTailor,
};

const LOCATIONS = ["WAREHOUSE", "SHOP", "IN_TRANSIT", "TAILOR"] as const;

const selectClass =
  "rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

/** Item + location filters that drive the ?itemTypeId=&location= URL params. */
export function MovementFilters({
  basePath,
  itemTypes,
  itemTypeId,
  location,
}: {
  basePath: string;
  itemTypes: ItemType[];
  itemTypeId?: number;
  location?: string;
}) {
  const router = useRouter();
  const go = (next: { itemTypeId?: number; location?: string }) => {
    const p = new URLSearchParams();
    if (next.itemTypeId) p.set("itemTypeId", String(next.itemTypeId));
    if (next.location) p.set("location", next.location);
    const qs = p.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  };
  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={itemTypeId ?? ""}
        onChange={(e) =>
          go({ itemTypeId: e.target.value ? Number(e.target.value) : undefined, location })
        }
        className={selectClass + " min-w-0 flex-1"}
      >
        <option value="">{labels.movements.allItems}</option>
        {itemTypes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.emoji ? `${t.emoji} ` : ""}
            {t.labelMy}
          </option>
        ))}
      </select>
      <select
        value={location ?? ""}
        onChange={(e) => go({ itemTypeId, location: e.target.value || undefined })}
        className={selectClass}
      >
        <option value="">{labels.movements.allLocations}</option>
        {LOCATIONS.map((l) => (
          <option key={l} value={l}>
            {LOC[l]}
          </option>
        ))}
      </select>
    </div>
  );
}

/** The movement list. Shows a running balance column when the API returned one
 *  (single item + location). */
export function MovementsList({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {labels.movements.empty}
      </p>
    );
  }
  const showBalance = movements.some((m) => m.balance != null);
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="p-3">{labels.movements.date}</th>
            <th className="p-3">{labels.movements.title}</th>
            <th className="p-3 text-right">{labels.movements.change}</th>
            {showBalance && <th className="p-3 text-right">{labels.movements.balance}</th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {movements.map((m) => (
            <tr key={m.lineId}>
              <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">
                {formatDateTime(m.occurredAt)}
              </td>
              <td className="p-3">
                <span className="font-medium">{labels.movements.kinds[m.kind] ?? m.kind}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {m.emoji ? `${m.emoji} ` : ""}
                  {m.itemLabel}
                  {" · "}
                  {LOC[m.location] ?? m.location}
                </span>
                {m.by && <span className="block text-xs text-muted-foreground">{m.by}</span>}
              </td>
              <td
                className={
                  "whitespace-nowrap p-3 text-right font-semibold tabular-nums " +
                  (m.signedQty >= 0 ? "text-emerald-700" : "text-rose-600")
                }
              >
                {m.signedQty >= 0 ? "+" : "−"}
                {Math.abs(m.signedQty).toLocaleString("en-US")}
              </td>
              {showBalance && (
                <td className="whitespace-nowrap p-3 text-right tabular-nums">
                  {m.balance != null ? m.balance.toLocaleString("en-US") : ""}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
