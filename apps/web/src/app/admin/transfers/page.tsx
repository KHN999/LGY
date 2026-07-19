import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import type { InventoryEvent } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { SearchInput } from "@/components/search-input";
import { VoidTransferButton } from "./void-transfer-button";

export const dynamic = "force-dynamic";

const LOC: Record<string, string> = {
  WAREHOUSE: labels.transfer.locWarehouse,
  SHOP: labels.transfer.locShop,
  IN_TRANSIT: labels.transfer.locInTransit,
};

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; search?: string }>;
}) {
  const { from, to, search } = await searchParams;
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  if (search?.trim()) p.set("search", search.trim());
  const qs = p.toString();
  const transfers = await serverFetch<InventoryEvent[]>(`/api/transfers${qs ? `?${qs}` : ""}`);
  const rows = transfers ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.transfers} />
      <DateFilter />
      <SearchInput placeholder={labels.transfer.searchItem} />
      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.transfers}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => {
            const out = e.lines.find((l) => l.direction === "OUT");
            const inLine = e.lines.find((l) => l.direction === "IN");
            return (
              <li key={e.id} className="flex items-start justify-between gap-2 p-4">
                <Link href={`/admin/transfers/${e.id}`} className="min-w-0 flex-1 hover:opacity-80">
                  <span className="text-sm text-muted-foreground">{formatDateTime(e.occurredAt)}</span>
                  <p className="mt-1 text-base">
                    <span className="font-medium">{LOC[out?.location ?? ""] ?? out?.location}</span>
                    {" → "}
                    <span className="font-medium">{LOC[inLine?.location ?? ""] ?? inLine?.location}</span>
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
                </Link>
                {e.voidedAt ? (
                  <span className="text-sm text-rose-600">{labels.salesAdmin.voided}</span>
                ) : (
                  <VoidTransferButton id={e.id} />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
