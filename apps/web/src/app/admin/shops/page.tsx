import { serverFetch } from "@/lib/auth-server";
import type { ShopState } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { PageHeader } from "@/components/ui";
import { FALLBACK_SHOPS } from "@/components/shop/shop-name";
import { ShopsManager } from "./shops-manager";

export const dynamic = "force-dynamic";

export default async function ShopsPage() {
  const [state, check] = await Promise.all([
    serverFetch<ShopState>("/api/shop"),
    serverFetch<{ ready: boolean; reason?: string }>("/api/shop/create-check"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.shop.manage} />
      <ShopsManager
        current={state?.shop ?? "main"}
        shops={state?.shops ?? FALLBACK_SHOPS}
        ready={check?.ready ?? false}
        notReadyReason={check?.reason}
      />
    </div>
  );
}
