import { serverFetch } from "@/lib/auth-server";
import type { SalesReport, ShopSettings } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";
import { SalesReportView } from "./sales-view";

export const dynamic = "force-dynamic";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();

  const [report, shop] = await Promise.all([
    serverFetch<SalesReport>(`/api/export/sales${qs ? `?${qs}` : ""}`),
    serverFetch<ShopSettings>("/api/settings"),
  ]);

  if (!report) {
    return <EmptyState>Could not load the sales report.</EmptyState>;
  }

  return <SalesReportView report={report} shop={shop} />;
}
