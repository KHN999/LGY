import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import type { AuditLogRow, Page } from "@/lib/api-client";
import { PageHeader, EmptyState } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{
    failures?: string;
    q?: string;
    from?: string;
    to?: string;
    range?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const failuresOnly = sp.failures === "1";

  const apiParams = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
  if (failuresOnly) apiParams.set("failuresOnly", "true");
  if (sp.q) apiParams.set("search", sp.q);
  if (sp.from) apiParams.set("from", sp.from);
  if (sp.to) apiParams.set("to", sp.to);

  const data = await serverFetch<Page<AuditLogRow>>(`/api/audit?${apiParams.toString()}`);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const hasNext = page * PAGE_SIZE < total;

  // Build a URL that keeps the current filters, applying `next` overrides.
  const href = (next: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    if (sp.from) p.set("from", sp.from);
    if (sp.to) p.set("to", sp.to);
    if (sp.range) p.set("range", sp.range);
    if (sp.q) p.set("q", sp.q);
    if (failuresOnly) p.set("failures", "1");
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/admin/audit?${qs}` : "/admin/audit";
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.audit.title} />
      <p className="-mt-2 text-sm text-muted-foreground">{labels.audit.subtitle}</p>

      <DateFilter />

      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={href({ failures: failuresOnly ? undefined : "1", page: undefined })}
          className={
            "rounded-lg px-3 py-1.5 text-sm " +
            (failuresOnly ? "bg-rose-600 text-white" : "border bg-card hover:bg-accent")
          }
        >
          {labels.audit.failuresOnly}
        </Link>
        <form action="/admin/audit" className="flex flex-1">
          {sp.from && <input type="hidden" name="from" value={sp.from} />}
          {sp.to && <input type="hidden" name="to" value={sp.to} />}
          {sp.range && <input type="hidden" name="range" value={sp.range} />}
          {failuresOnly && <input type="hidden" name="failures" value="1" />}
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder={labels.audit.searchPlaceholder}
            className="w-full min-w-0 rounded-lg border bg-background px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{labels.audit.noData}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/audit/${r.id}`}
                className="flex items-start justify-between gap-3 p-3 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium leading-snug">{r.summary ?? `${r.method} ${r.path}`}</p>
                  {r.shop === "playground" && (
                    <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                      {labels.audit.shopTest}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {r.username ?? "—"} · {formatDateTime(r.createdAt)}
                  {r.durationMs != null ? ` · ${r.durationMs}ms` : ""}
                </p>
                {!r.ok && r.error && (
                  <p className="mt-1 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
                    {r.error}
                  </p>
                )}
              </div>
              <span
                className={
                  "shrink-0 rounded px-2 py-0.5 text-xs font-semibold " +
                  (r.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900")
                }
              >
                  {r.ok ? labels.audit.success : labels.audit.failed}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between">
          {page > 1 ? (
            <Link
              href={href({ page: String(page - 1) })}
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-accent"
            >
              ← {labels.audit.newer}
            </Link>
          ) : (
            <span />
          )}
          {hasNext ? (
            <Link
              href={href({ page: String(page + 1) })}
              className="rounded-lg border bg-card px-4 py-2 text-sm hover:bg-accent"
            >
              {labels.audit.older} →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
