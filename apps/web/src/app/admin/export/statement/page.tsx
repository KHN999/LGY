import { serverFetch } from "@/lib/auth-server";
import type { Statement, ShopSettings } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";
import { StatementView } from "./statement-view";

export const dynamic = "force-dynamic";

export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();

  const [statement, shop] = await Promise.all([
    serverFetch<Statement>(`/api/export/statement${qs ? `?${qs}` : ""}`),
    serverFetch<ShopSettings>("/api/settings"),
  ]);

  if (!statement) {
    return <EmptyState>Could not load the statement.</EmptyState>;
  }

  return <StatementView statement={statement} shop={shop} />;
}
