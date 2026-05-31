import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Sale } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";

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

const FILTERS: Array<{ key?: Sale["status"]; label: string }> = [
  { label: labels.salesAdmin.filterAll },
  { key: "UNPAID", label: labels.domain.statusUnpaid },
  { key: "PARTIAL", label: labels.domain.statusPartial },
  { key: "PAID", label: labels.domain.statusPaid },
];

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; range?: string }>;
}) {
  const { status, from, to, range } = await searchParams;

  const apiParams = new URLSearchParams({ limit: "50" });
  if (status) apiParams.set("status", status);
  if (from) apiParams.set("fromDate", from);
  if (to) apiParams.set("toDate", to);
  const page = await serverFetch<Page<Sale>>(`/api/sales?${apiParams.toString()}`);
  const rows = page?.data ?? [];

  // Status tabs keep the active date range.
  const statusHref = (key?: Sale["status"]) => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (range) p.set("range", range);
    if (key) p.set("status", key);
    const qs = p.toString();
    return qs ? `/admin/sales?${qs}` : "/admin/sales";
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.salesAdmin.title} />

      <DateFilter />

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (f.key ?? undefined) === (status ?? undefined);
          return (
            <Link
              key={f.label}
              href={statusHref(f.key)}
              className={
                "rounded-lg px-3 py-1.5 text-sm " +
                (active ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState>{labels.salesAdmin.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((s) => {
            const remaining = s.grandTotal - s.paidAmount;
            return (
              <li key={s.id}>
                <Link
                  href={`/admin/sales/${s.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">
                        #{s.id} {s.customer?.name ?? labels.salesAdmin.walkIn}
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
                    <p className="mt-1 text-sm text-muted-foreground">
                      {s.lines.length} {labels.sell.line} ·{" "}
                      {new Date(s.saleDate).toLocaleDateString("en-US")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={
                        "text-sm font-medium " +
                        (s.voidedAt ? "text-muted-foreground line-through" : "")
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
    </div>
  );
}
