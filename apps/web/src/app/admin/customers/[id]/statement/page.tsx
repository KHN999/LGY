import { serverFetch } from "@/lib/auth-server";
import type { CustomerStatement, ShopSettings } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { yangonYmd } from "@/lib/utils";
import { EmptyState } from "@/components/ui";
import { StatementView } from "./statement-view";

export const dynamic = "force-dynamic";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; all?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const today = yangonYmd(new Date());
  // Default: this month so far. `all=1` means the whole history.
  const all = sp.all === "1";
  const from = all ? undefined : sp.from && YMD.test(sp.from) ? sp.from : `${today.slice(0, 8)}01`;
  const to = all ? undefined : sp.to && YMD.test(sp.to) ? sp.to : today;

  const qs = new URLSearchParams();
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);
  const [statement, shop] = await Promise.all([
    serverFetch<CustomerStatement>(`/api/customers/${id}/statement${qs.size ? `?${qs}` : ""}`),
    serverFetch<ShopSettings>("/api/settings"),
  ]);
  if (!statement) return <EmptyState>{labels.customerStatement.loadFailed}</EmptyState>;

  return <StatementView s={statement} shop={shop ?? undefined} today={today} from={from} to={to} />;
}
