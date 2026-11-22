import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, hasRole, serverFetch } from "@/lib/auth-server";
import type { AnalyticsOverview, ShopState } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Report } from "./report";
import { t } from "./text.my";

export const dynamic = "force-dynamic";

export default async function DataAnalysisPage() {
  const [user, shopState] = await Promise.all([getCurrentUser(), serverFetch<ShopState>("/api/shop")]);
  if (!user) redirect("/login?redirect=/data-analysis");
  if (!hasRole(user, "admin")) redirect("/staff");

  const o = await serverFetch<AnalyticsOverview>("/api/analytics/overview");
  const shopLabel = shopState?.shop === "playground" ? t.shopTest : t.shopMain;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-3 pb-16 sm:p-6 [&>*]:min-w-0">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/admin" className="rounded-lg border px-3 py-1.5">← {t.back}</Link>
          <Link href="/explain" className="rounded-lg border px-3 py-1.5">{t.explainLink} →</Link>
        </div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.shopNote(shopLabel)}</p>
        {o && o.period.from && o.period.to && (
          <p className="text-sm text-muted-foreground">
            {t.period(formatDate(o.period.from), formatDate(o.period.to), o.totals.saleDays)}
            <br />
            {t.generated(formatDateTime(o.generatedAt))}
          </p>
        )}
      </header>

      {!o ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900">{t.loadFailed}</p>
      ) : o.totals.orders === 0 ? (
        <p className="rounded-xl border p-6 text-center text-muted-foreground">{t.noData}</p>
      ) : (
        <Report o={o} />
      )}
    </main>
  );
}
