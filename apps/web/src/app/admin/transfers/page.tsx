import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { InventoryEvent } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function TransfersPage() {
  const transfers = await serverFetch<InventoryEvent[]>("/api/transfers");
  const rows = transfers ?? [];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{labels.admin.transfers}</h1>
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.admin.empty.transfers}
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => {
            const out = e.lines.find((l) => l.direction === "OUT");
            const inLine = e.lines.find((l) => l.direction === "IN");
            return (
              <li key={e.id} className="p-4">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{new Date(e.occurredAt).toLocaleString("en-US", { hour12: true })}</span>
                  {e.voidedAt && <span className="text-rose-600">VOIDED</span>}
                </div>
                <p className="mt-1 text-base">
                  <span className="font-medium">{out?.location}</span>
                  {" → "}
                  <span className="font-medium">{inLine?.location}</span>
                </p>
                <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                  {e.lines
                    .filter((l) => l.direction === "OUT")
                    .map((l) => (
                      <li key={l.id} className="rounded-full bg-muted px-3 py-1">
                        {l.itemType?.emoji ?? ""} {l.itemType?.labelMy ?? `#${l.itemTypeId}`} ×{" "}
                        <span className="font-semibold">{l.qty}</span>
                      </li>
                    ))}
                </ul>
                {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
