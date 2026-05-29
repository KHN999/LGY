import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Sale } from "@/lib/api-client";

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
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const qs = status ? `?status=${status}&limit=50` : "?limit=50";
  const page = await serverFetch<Page<Sale>>(`/api/sales${qs}`);
  const rows = page?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{labels.salesAdmin.title}</h1>

      <nav className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (f.key ?? undefined) === (status ?? undefined);
          return (
            <Link
              key={f.label}
              href={f.key ? `/admin/sales?status=${f.key}` : "/admin/sales"}
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
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.salesAdmin.empty}
        </div>
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
                        #{s.id} {s.customer?.name}
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
                  <div className="text-right">
                    <p
                      className={
                        "text-sm font-medium " +
                        (s.voidedAt ? "text-muted-foreground line-through" : "")
                      }
                    >
                      {formatKyat(s.grandTotal)}
                    </p>
                    {!s.voidedAt && remaining > 0 && (
                      <p className="text-xs text-rose-600">
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
