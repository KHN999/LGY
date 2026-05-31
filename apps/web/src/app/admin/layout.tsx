import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, serverFetch } from "@/lib/auth-server";
import type { ShopState } from "@/lib/api-client";
import { AdminShell } from "@/components/admin/admin-shell";
import { ShopBanner } from "@/components/shop/shop-banner";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin");
  if (!hasRole(user, "admin")) redirect("/staff");

  const shopState = await serverFetch<ShopState>("/api/shop");
  const shop = shopState?.shop ?? "main";

  return (
    <div className="min-h-screen bg-background">
      <ShopBanner shop={shop} isAdmin />
      <AdminShell user={user} currentShop={shop}>
        {children}
      </AdminShell>
    </div>
  );
}
