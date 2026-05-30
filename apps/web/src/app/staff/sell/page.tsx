import { serverFetch } from "@/lib/auth-server";
import type { ShopSettings } from "@/lib/api-client";
import { SellFlow } from "./sell-flow";

export const dynamic = "force-dynamic";

export default async function SellPage() {
  const shop = await serverFetch<ShopSettings>("/api/settings");
  return <SellFlow shop={shop ?? undefined} />;
}
