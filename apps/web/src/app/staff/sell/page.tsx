import { serverFetch } from "@/lib/auth-server";
import type { ShopSettings, ShopState } from "@/lib/api-client";
import { SellFlow } from "./sell-flow";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const [shop, shopState] = await Promise.all([
    serverFetch<ShopSettings>("/api/settings"),
    serverFetch<ShopState>("/api/shop"),
  ]);
  return <SellFlow shop={shop ?? undefined} shopId={shopState?.shop ?? "main"} />;
}
