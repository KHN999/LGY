import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/auth-server";
import { UserMenu } from "@/components/user-menu";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/staff");
  if (!hasRole(user, "staff") && !hasRole(user, "admin")) {
    redirect("/login?redirect=/staff");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-card px-4 py-3">
        <span className="text-base font-semibold">LGY</span>
        <UserMenu user={user} />
      </header>
      <div>{children}</div>
    </div>
  );
}
