import { serverFetch } from "@/lib/auth-server";
import type { StockRow, ItemType } from "@/lib/api-client";
import { WashFlow } from "./wash-flow";

export const dynamic = "force-dynamic";

export default async function WashPage() {
  const [warehouseStock, itemTypes] = await Promise.all([
    serverFetch<StockRow[]>("/api/inventory/stock?location=WAREHOUSE"),
    serverFetch<ItemType[]>("/api/item-types"),
  ]);
  return <WashFlow warehouseStock={warehouseStock ?? []} itemTypes={itemTypes ?? []} />;
}
