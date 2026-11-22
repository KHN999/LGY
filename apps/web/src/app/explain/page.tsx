import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasRole } from "@/lib/auth-server";
import { ExplainView } from "./explain-view";
import { page } from "./content.my";

export const dynamic = "force-dynamic";

/** Written guide to what every screen does and what it is linked to (admin only). */
export default async function ExplainPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?redirect=/explain");
  if (!hasRole(user, "admin")) redirect("/staff");

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 p-4 pb-16 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/admin" className="rounded-lg border px-3 py-1.5">← {page.back}</Link>
          <Link href="/data-analysis" className="rounded-lg border px-3 py-1.5">{page.analysisLink} →</Link>
        </div>
        <h1 className="text-2xl font-bold">{page.title}</h1>
        <p className="text-lg text-muted-foreground">{page.subtitle}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{page.checked}</p>
      </header>
      <ExplainView />
    </main>
  );
}
