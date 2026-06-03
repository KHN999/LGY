import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import type { AuditLogRow } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

function Field({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="break-words font-medium">{value}</span>
    </div>
  );
}

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await serverFetch<AuditLogRow>(`/api/audit/${id}`);

  if (!row) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/admin/audit" className="self-start rounded-lg border px-4 py-2 text-sm hover:bg-accent">
          ← Audit log
        </Link>
        <EmptyState>Not found.</EmptyState>
      </div>
    );
  }

  const payloadStr =
    row.payload && typeof row.payload === "object" && Object.keys(row.payload).length > 0
      ? JSON.stringify(row.payload, null, 2)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/audit" className="self-start rounded-lg border px-4 py-2 text-sm hover:bg-accent">
        ← Audit log
      </Link>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-bold">{row.summary ?? `${row.method} ${row.path}`}</h1>
        <span
          className={
            "rounded px-2 py-0.5 text-xs font-semibold " +
            (row.ok ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900")
          }
        >
          {row.ok ? "OK" : "Failed"}
        </span>
        {row.shop === "playground" && (
          <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
            Test
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-2xl border bg-card p-4 sm:grid-cols-3">
        <Field label="User" value={row.username ?? "—"} />
        <Field label="When" value={new Date(row.createdAt).toLocaleString("en-GB")} />
        <Field label="Shop" value={row.shop} />
        <Field label="Route" value={`${row.method} ${row.path}`} />
        <Field label="Status" value={row.status} />
        <Field label="Duration" value={row.durationMs != null ? `${row.durationMs} ms` : "—"} />
        <Field label="Entity" value={row.entity ? `${row.entity}${row.entityId ? ` #${row.entityId}` : ""}` : "—"} />
        <Field label="IP" value={row.ip ?? "—"} />
      </div>

      {!row.ok && row.error && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <p className="mb-1 text-xs font-semibold text-destructive">Error</p>
          <p className="break-words text-sm text-destructive">{row.error}</p>
        </div>
      )}

      {payloadStr && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Request data (secrets redacted)</p>
          <pre className="overflow-x-auto rounded-lg bg-muted/50 p-3 text-xs">{payloadStr}</pre>
        </div>
      )}
    </div>
  );
}
