import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-server";
import { LoginForm } from "./login-form";
import { labels } from "@/lib/labels";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    // Already logged in — go where they were headed, or pick a sensible default.
    const dest = params.redirect ?? defaultLanding(user.roles);
    redirect(dest);
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">
          {labels.auth.loginTitle}
        </h1>
        <LoginForm redirectTo={params.redirect} />
      </div>
    </main>
  );
}

function defaultLanding(roles: string[]): string {
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("staff")) return "/staff";
  return "/";
}
