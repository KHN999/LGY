import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, serverFetch } from "@/lib/auth-server";
import type { ShopState } from "@/lib/api-client";
import { ShopBanner } from "@/components/shop/shop-banner";
import { OfflineBanner } from "@/components/staff/offline-banner";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  // Fire both round-trips in parallel — they're independent.
  const [user, shopState] = await Promise.all([
    getCurrentUser(),
    serverFetch<ShopState>("/api/shop"),
  ]);
  if (!user) redirect("/login?redirect=/staff");
  if (!hasRole(user, "staff") && !hasRole(user, "admin")) {
    redirect("/login?redirect=/staff");
  }

  // No app-bar on staff screens — each flow has its own Back, and the cash-register
  // pages need the full height. The account/logout menu lives on the staff home.
  return (
    <div className="min-h-screen bg-background">
      <ShopBanner shop={shopState?.shop ?? "main"} isAdmin={hasRole(user, "admin")} />
      <OfflineBanner />
      {children}
    </div>
  );
}
