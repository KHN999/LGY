import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { StockExceptionRow } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { ExceptionsList } from "./exceptions-list";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage() {
  const rows = await serverFetch<StockExceptionRow[]>("/api/stock-exceptions");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={labels.exceptions.title} subtitle={labels.exceptions.help} />
      <ExceptionsList rows={rows ?? []} />
    </div>
  );
}
