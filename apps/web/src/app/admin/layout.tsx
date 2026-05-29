import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/admin");
  if (!hasRole(user, "admin")) redirect("/staff");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold">LGY Admin</span>
          <UserMenu user={user} />
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-3 sm:px-6">
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
