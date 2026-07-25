import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { StockMovement, ItemType } from "@/lib/api-client";
import { MovementFilters, GroupedMovements } from "@/components/stock-movements";

export const dynamic = "force-dynamic";

export default async function StaffStockMovementsPage({
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-10 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/staff" className="rounded-lg border px-3 py-1.5 text-sm">
          ← {labels.staff.home}
        </Link>
        <h1 className="text-lg font-bold">{labels.movements.title}</h1>
        <span className="w-16" />
      </div>
      <MovementFilters
        basePath="/staff/stock-movements"
        itemTypes={itemTypes ?? []}
        itemTypeId={itemTypeId ? Number(itemTypeId) : undefined}
        location={location}
      />
      <GroupedMovements movements={movements ?? []} />
    </main>
  );
}
