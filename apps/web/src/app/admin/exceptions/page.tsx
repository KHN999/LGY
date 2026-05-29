import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { StockExceptionRow } from "@/lib/api-client";
import { ExceptionsList } from "./exceptions-list";

export const dynamic = "force-dynamic";

export default async function ExceptionsPage() {
  const rows = await serverFetch<StockExceptionRow[]>("/api/stock-exceptions");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{labels.exceptions.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{labels.exceptions.help}</p>
      </div>
      <ExceptionsList rows={rows ?? []} />
    </div>
  );
}
