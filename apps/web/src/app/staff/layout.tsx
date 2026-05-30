import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/auth-server";
import { ShopBanner } from "@/components/shop/shop-banner";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/staff");
  if (!hasRole(user, "staff") && !hasRole(user, "admin")) {
    redirect("/login?redirect=/staff");
  }

  // No app-bar on staff screens — each flow has its own Back, and the cash-register
  // pages need the full height. The account/logout menu lives on the staff home.
  return (
    <div className="min-h-screen bg-background">
      <ShopBanner isAdmin={hasRole(user, "admin")} />
      {children}
    </div>
  );
}
