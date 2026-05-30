import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { AdminDesktopNav, AdminMobileNav } from "@/components/admin/admin-nav";
import { ShopBanner } from "@/components/shop/shop-banner";
import { ShopSwitcher } from "@/components/shop/shop-switcher";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin");
  if (!hasRole(user, "admin")) redirect("/staff");

  return (
    <div className="min-h-screen bg-background">
      <ShopBanner isAdmin />
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <AdminMobileNav />
            <span className="truncate text-lg font-semibold">LGY Admin</span>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ShopSwitcher />
            <UserMenu user={user} />
          </div>
        </div>
        <div className="mx-auto hidden max-w-6xl px-4 pb-3 sm:px-6 md:block">
          <AdminDesktopNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
