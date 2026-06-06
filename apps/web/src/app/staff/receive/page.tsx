import { serverFetch } from "@/lib/auth-server";
import type { ShopSettings } from "@/lib/api-client";
import { ReceiveMoneyFlow } from "./receive-flow";

export const dynamic = "force-dynamic";

export default async function ReceiveMoneyPage() {
  const shop = await serverFetch<ShopSettings>("/api/settings");
  return <ReceiveMoneyFlow shop={shop ?? undefined} />;
}
