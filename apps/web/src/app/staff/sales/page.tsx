import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { Page, Sale } from "@/lib/api-client";
import { SalesDateFilter } from "./sales-date-filter";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<Sale["status"], string> = {
  UNPAID: labels.domain.statusUnpaid,
  PARTIAL: labels.domain.statusPartial,
  PAID: labels.domain.statusPaid,
};
const STATUS_TONE: Record<Sale["status"], string> = {
  UNPAID: "bg-rose-100 text-rose-900",
  PARTIAL: "bg-amber-100 text-amber-900",
  PAID: "bg-emerald-100 text-emerald-900",
};

export default async function StaffSalesHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; search?: string }>;
}) {
  const { date, search } = await searchParams;
  const params = new URLSearchParams({ limit: "50" });
  if (date) {
    // Filter to that single Yangon (+06:30) business day.
    params.set("fromDate", new Date(`${date}T00:00:00.000+06:30`).toISOString());
    params.set("toDate", new Date(`${date}T23:59:59.999+06:30`).toISOString());
  }
  if (search) params.set("search", search);
  const page = await serverFetch<Page<Sale>>(`/api/sales?${params.toString()}`);
  const rows = page?.data ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 sm:p-6">
      <Link href="/staff" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.common.back}
      </Link>
      <h1 className="text-xl font-bold">{labels.history.title}</h1>
      <SearchInput />
      <SalesDateFilter />

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.history.empty}
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((s) => {
            const remaining = s.grandTotal - s.paidAmount;
            return (
              <li key={s.id}>
                <Link
                  href={`/staff/sales/${s.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">
                        #{s.id} {s.customer?.name ?? s.customerName ?? labels.sell.walkInCustomer}
                      </span>
                      {s.voidedAt ? (
                        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {labels.salesAdmin.voided}
                        </span>
                      ) : (
                        <span className={"rounded px-2 py-0.5 text-xs " + STATUS_TONE[s.status]}>
                          {STATUS_LABEL[s.status]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(s.saleDate)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={
                        "font-medium " + (s.voidedAt ? "text-muted-foreground line-through" : "")
                      }
                    >
                      {formatKyat(s.grandTotal)}
                    </p>
                    {!s.voidedAt && remaining > 0 && (
                      <p className="text-sm text-rose-600">
                        {labels.domain.remaining}: {formatKyat(remaining)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
