import { serverFetch } from "@/lib/auth-server";
import type { Statement } from "@/lib/api-client";
import { PageHeader, Card } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { formatKyat } from "@/lib/utils";

export const dynamic = "force-dynamic";

const btn =
  "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90";
const btnOutline =
  "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold hover:bg-accent";

export default async function ExportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const qs = params.toString();
  const suffix = qs ? `?${qs}` : "";

  // Show real numbers for the chosen period right on the page.
  const stmt = await serverFetch<Statement>(`/api/export/statement${suffix}`);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Export / Backup"
        subtitle="Download your data — a period statement (PDF or CSV) or a full JSON backup you keep off Railway."
      />

      {/* ---------- Period statement ---------- */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Statement</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A bank-statement-style cash ledger for a period: money in (payments received) and out
          (supplier &amp; tailor payments, expenses, refunds), with a running balance.
        </p>

        <div className="mt-4">
          <DateFilter />
        </div>

        {stmt && (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <Stat label="Period" value={`${stmt.from} → ${stmt.to}`} />
              <Stat label="Money in" value={formatKyat(stmt.totalIn)} />
              <Stat label="Money out" value={formatKyat(stmt.totalOut)} />
              <Stat label="Closing balance" value={formatKyat(stmt.closingCash)} />
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              {stmt.transactions.length} cash movements · sales {formatKyat(stmt.salesTotal)} ({stmt.salesCount})
            </p>
          </>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <a href={`/api/export/statement.csv${suffix}`} className={btn}>
            ⬇️ Download CSV
          </a>
          <a
            href={`/admin/export/statement${suffix}`}
            target="_blank"
            rel="noopener noreferrer"
            className={btnOutline}
          >
            📄 PDF statement
          </a>
        </div>
      </Card>

      {/* ---------- Full backup ---------- */}
      <Card className="p-5">
        <h2 className="text-lg font-semibold">Full backup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A complete copy of every record — sales, payments, inventory, customers, suppliers, orders,
          expenses, daily closes and more — as one JSON file. Keep it somewhere safe off Railway so your
          data survives even if the server is lost. (Login passwords are not included.)
        </p>
        <div className="mt-5">
          <a href="/api/export/backup.json" className={btn}>
            ⬇️ Download full backup (JSON)
          </a>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}
