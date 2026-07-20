import { serverFetch } from "@/lib/auth-server";
import type { StockRow, ItemType } from "@/lib/api-client";
import { CutFlow } from "./cut-flow";

export const dynamic = "force-dynamic";

export default async function CutPage() {
  const [warehouseStock, itemTypes] = await Promise.all([
    serverFetch<StockRow[]>("/api/inventory/stock?location=WAREHOUSE"),
    serverFetch<ItemType[]>("/api/item-types"),
  ]);
  return <CutFlow warehouseStock={warehouseStock ?? []} itemTypes={itemTypes ?? []} />;
}
