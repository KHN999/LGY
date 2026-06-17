import { serverFetch } from "@/lib/auth-server";
import type { DebtorsReport, ShopSettings } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";
import { DebtorsReportView } from "./debtors-view";

export const dynamic = "force-dynamic";

export default async function DebtorsReportPage() {
  const [report, shop] = await Promise.all([
    serverFetch<DebtorsReport>("/api/export/debtors"),
    serverFetch<ShopSettings>("/api/settings"),
  ]);

  if (!report) {
    return <EmptyState>Could not load the debtors report.</EmptyState>;
  }

  return <DebtorsReportView report={report} shop={shop} />;
}
