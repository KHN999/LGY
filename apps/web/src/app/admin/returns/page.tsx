import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";
import type { AdminReturnRow } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { VoidReturnButton } from "./void-return-button";

export const dynamic = "force-dynamic";

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const qs = p.toString();
  const rows = (await serverFetch<AdminReturnRow[]>(`/api/returns${qs ? `?${qs}` : ""}`)) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.returnsAdmin.title} />
      <DateFilter />
      {rows.length === 0 ? (
        <EmptyState>{labels.returnsAdmin.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{formatDate(r.returnDate)}</span>
                  {r.customer ? (
                    <Link
                      href={`/admin/customers/${r.customer.id}`}
                      className="font-medium text-foreground hover:underline"
                    >
                      {r.customer.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-foreground">{labels.returnsAdmin.walkIn}</span>
                  )}
                  <Link href={`/admin/sales/${r.saleId}`} className="hover:underline">
                    {labels.returnsAdmin.sale} #{r.saleId}
                  </Link>
                </div>
                <p className="mt-1 text-base">
                  <span className="text-muted-foreground">{labels.returnsAdmin.returnedValue}: </span>
                  <span className="font-semibold">{formatKyat(r.returnTotal)}</span>
                  {r.refundAmount > 0 && (
                    <>
                      <span className="text-muted-foreground"> · {labels.returnsAdmin.refund}: </span>
                      <span className="font-semibold text-rose-600">{formatKyat(r.refundAmount)}</span>
                    </>
                  )}
                </p>
                {r.lines.length > 0 && (
                  <ul className="mt-1 flex flex-wrap gap-2 text-sm">
                    {r.lines.map((l) => (
                      <li key={l.id} className="rounded-full bg-muted px-3 py-1">
                        {l.itemType?.emoji ?? ""} {l.itemType?.labelMy ?? l.itemName ?? `#${l.itemTypeId}`} ×{" "}
                        <span className="font-semibold">{l.qty}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <VoidReturnButton id={r.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
