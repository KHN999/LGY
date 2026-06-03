import { serverFetch } from "@/lib/auth-server";
import type { Page, Driver, ShopState } from "@/lib/api-client";
import { TransferFlow } from "./transfer-flow";

export const dynamic = "force-dynamic";

export default async function TransferPage() {
  const [drivers, shopState] = await Promise.all([
    serverFetch<Page<Driver>>("/api/drivers?limit=200"),
    serverFetch<ShopState>("/api/shop"),
  ]);
  return <TransferFlow drivers={drivers?.data ?? []} shopId={shopState?.shop ?? "main"} />;
}
