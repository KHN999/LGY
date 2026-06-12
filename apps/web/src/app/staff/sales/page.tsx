import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { Page, Sale } from "@/lib/api-client";
import { SalesDateFilter } from "./sales-date-filter";

export const dynamic = "force-dynamic";

export default async function StaffSalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const params = new URLSearchParams({ limit: "50" });
  if (date) {
    // Filter to that single Yangon (+06:30) business day.
    params.set("fromDate", new Date(`${date}T00:00:00.000+06:30`).toISOString());
    params.set("toDate", new Date(`${date}T23:59:59.999+06:30`).toISOString());
  }
  const page = await serverFetch<Page<Sale>>(`/api/sales?${params.toString()}`);
  const rows = page?.data ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 sm:p-6">
      <Link href="/staff" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.common.back}
      </Link>
      <h1 className="text-xl font-bold">{labels.history.title}</h1>
      <SalesDateFilter />

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.history.empty}
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/staff/sales/${s.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    #{s.id} {s.customer?.name ?? s.customerName ?? labels.sell.walkInCustomer}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(s.saleDate)}
                    {s.voidedAt && ` · ${labels.salesAdmin.voided}`}
                  </p>
                </div>
                <span
                  className={
                    "shrink-0 font-medium " + (s.voidedAt ? "text-muted-foreground line-through" : "")
                  }
                >
                  {formatKyat(s.grandTotal)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
