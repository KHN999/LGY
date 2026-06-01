import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { DailyClose } from "@/lib/api-client";
import { PageHeader, EmptyState, Card } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";

export const dynamic = "force-dynamic";

function diffClass(d: number) {
  return d < 0 ? "text-rose-600" : d > 0 ? "text-emerald-600" : "";
}
function diffText(d: number) {
  return (d > 0 ? "+" : "") + formatKyat(d);
}

export default async function ClosesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const qs = p.toString();
  const closes = await serverFetch<DailyClose[]>(`/api/daily-close${qs ? `?${qs}` : ""}`);
  const rows = closes ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.admin.closes} />

      <DateFilter />

      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.closes}</EmptyState>
      ) : (
        <>
          {/* Phone: one card per close */}
          <div className="flex flex-col gap-3 md:hidden">
            {rows.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="mb-2 flex items-center justify-between border-b pb-2">
                  <span className="font-semibold">{c.date}</span>
                  <span className={"font-bold tabular-nums " + diffClass(c.difference)}>
                    {diffText(c.difference)}
                  </span>
                </div>
                <dl className="flex flex-col gap-1 text-sm">
                  <Line label={labels.close.openingCash} value={formatKyat(c.openingCash)} />
                  <Line label={labels.close.received} value={formatKyat(c.receivedTotal)} />
                  <Line label={labels.close.paidOut} value={formatKyat(c.paidOutTotal)} />
                  <Line label={labels.close.expectedCash} value={formatKyat(c.expectedCash)} />
                  <Line label={labels.close.countedCash} value={formatKyat(c.countedCash)} />
                </dl>
              </Card>
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto rounded-2xl border bg-card md:block">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">{labels.close.today}</th>
                  <th className="px-3 py-2 text-right font-medium">{labels.close.openingCash}</th>
                  <th className="px-3 py-2 text-right font-medium">{labels.close.received}</th>
                  <th className="px-3 py-2 text-right font-medium">{labels.close.paidOut}</th>
                  <th className="px-3 py-2 text-right font-medium">{labels.close.expectedCash}</th>
                  <th className="px-3 py-2 text-right font-medium">{labels.close.countedCash}</th>
                  <th className="px-3 py-2 text-right font-medium">{labels.close.difference}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b last:border-b-0">
                    <td className="px-3 py-2">{c.date}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKyat(c.openingCash)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKyat(c.receivedTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKyat(c.paidOutTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKyat(c.expectedCash)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatKyat(c.countedCash)}</td>
                    <td className={"px-3 py-2 text-right font-semibold tabular-nums " + diffClass(c.difference)}>
                      {diffText(c.difference)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
