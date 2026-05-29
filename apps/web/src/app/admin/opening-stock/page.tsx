import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { ItemType, InventoryEvent } from "@/lib/api-client";
import { OpeningStockForm } from "./opening-stock-form";
import { formatKyat } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpeningStockPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const [types, history] = await Promise.all([
    serverFetch<ItemType[]>("/api/item-types"),
    serverFetch<InventoryEvent[]>("/api/opening-stock"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{labels.admin.openingStock}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{labels.admin.openingStockHelp}</p>
      </div>

      {params.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      <OpeningStockForm itemTypes={types ?? []} />

      {history && history.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 text-base font-semibold">အစတော့ မှတ်တမ်း</h2>
          <ul className="flex flex-col divide-y">
            {history.slice(0, 10).map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-xs text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleString("en-US", { hour12: true })}
                  {e.notes && ` · ${e.notes}`}
                </p>
                <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                  {e.lines.map((l) => (
                    <li key={l.id} className="rounded-full bg-muted px-3 py-1">
                      {l.itemType?.emoji ?? ""} {l.itemType?.labelMy ?? `#${l.itemTypeId}`} ×{" "}
                      <span className="font-semibold">{l.qty}</span>
                      {" @ " + l.location}
                      {l.unitCost !== null && ` (${formatKyat(l.unitCost)})`}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
