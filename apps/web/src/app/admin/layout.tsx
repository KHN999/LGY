import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, serverFetch } from "@/lib/auth-server";
import type { ShopState } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/admin-shell";
import { ShopBanner } from "@/components/shop/shop-banner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Fire both round-trips in parallel — they're independent. (Sequential awaits
  // here were the latency floor for every admin navigation.)
  const [user, shopState] = await Promise.all([
    getCurrentUser(),
    serverFetch<ShopState>("/api/shop"),
  ]);
  if (!user) redirect("/login?redirect=/admin");
  if (!hasRole(user, "admin")) redirect("/staff");

  const shop = shopState?.shop ?? "main";

  return (
    <div className="min-h-screen bg-background">
      <ShopBanner shop={shop} home="/admin" />
      <AdminShell user={user} currentShop={shop}>
        {children}
      </AdminShell>
    </div>
  );
}
