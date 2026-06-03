import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import type { InventoryEvent } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";

export const dynamic = "force-dynamic";

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const qs = p.toString();
  const transfers = await serverFetch<InventoryEvent[]>(`/api/transfers${qs ? `?${qs}` : ""}`);
  const rows = transfers ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.transfers} />
      <DateFilter />
      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.transfers}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => {
            const out = e.lines.find((l) => l.direction === "OUT");
            const inLine = e.lines.find((l) => l.direction === "IN");
            return (
              <li key={e.id} className="p-4">
                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>{formatDateTime(e.occurredAt)}</span>
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
