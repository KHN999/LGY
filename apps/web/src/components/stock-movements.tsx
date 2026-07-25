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

/** Transaction view — one row per event, with the −out / +in lines grouped as
 *  chips (a cut's −roll and +pieces read as a single transaction). Used in the
 *  staff app. Shows the running balance when the API returned one. */
export function GroupedMovements({ movements }: { movements: StockMovement[] }) {
  if (movements.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
        {labels.movements.empty}
      </p>
    );
  }
  // Group by event, preserving the newest-first order the API returned.
  const groups: { head: StockMovement; lines: StockMovement[] }[] = [];
  const at = new Map<number, number>();
  for (const m of movements) {
    let i = at.get(m.eventId);
    if (i == null) {
      i = groups.length;
      at.set(m.eventId, i);
      groups.push({ head: m, lines: [] });
    }
    groups[i].lines.push(m);
  }
  return (
    <ul className="flex flex-col divide-y rounded-2xl border bg-card">
      {groups.map(({ head, lines }) => {
        // Outs (−) before ins (+) so it reads "from → to".
        const sorted = [...lines].sort(
          (a, b) => (a.direction === "OUT" ? 0 : 1) - (b.direction === "OUT" ? 0 : 1),
        );
        const bal = lines.find((l) => l.balance != null)?.balance ?? null;
        return (
          <li key={head.eventId} className="flex flex-col gap-1.5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">
                {labels.movements.kinds[head.kind] ?? head.kind}
              </span>
              <span className="text-xs text-muted-foreground">{formatDateTime(head.occurredAt)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {sorted.map((l) => (
                <span
                  key={l.lineId}
                  className={
                    "rounded-full px-2.5 py-1 text-xs font-medium tabular-nums " +
                    (l.signedQty >= 0
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800")
                  }
                >
                  {l.signedQty >= 0 ? "+" : "−"}
                  {Math.abs(l.signedQty).toLocaleString("en-US")} {l.emoji ? `${l.emoji} ` : ""}
                  {l.itemLabel}
                  <span className="opacity-60"> · {LOC[l.location] ?? l.location}</span>
                </span>
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{head.by ?? ""}</span>
              {bal != null && (
                <span>
                  {labels.movements.balance}: <span className="font-semibold tabular-nums">{bal.toLocaleString("en-US")}</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
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
