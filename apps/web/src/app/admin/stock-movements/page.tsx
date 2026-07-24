import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { StockMovement, ItemType } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { MovementFilters, MovementsList } from "@/components/stock-movements";

export const dynamic = "force-dynamic";

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ itemTypeId?: string; location?: string }>;
}) {
  const { itemTypeId, location } = await searchParams;
  const p = new URLSearchParams();
  if (itemTypeId) p.set("itemTypeId", itemTypeId);
  if (location) p.set("location", location);
  const qs = p.toString();

  const [movements, itemTypes] = await Promise.all([
    serverFetch<StockMovement[]>(`/api/inventory/movements${qs ? `?${qs}` : ""}`),
    serverFetch<ItemType[]>("/api/item-types"),
  ]);

  const singleItem = !!itemTypeId;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.movements.title} />
      <MovementFilters
        basePath="/admin/stock-movements"
        itemTypes={itemTypes ?? []}
        itemTypeId={itemTypeId ? Number(itemTypeId) : undefined}
        location={location}
      />
      {singleItem && !location && (
        <p className="text-xs text-muted-foreground">{labels.movements.pickItemForBalance}</p>
      )}
      <MovementsList movements={movements ?? []} />
    </div>
  );
}
