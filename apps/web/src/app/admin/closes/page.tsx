import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { DailyClose } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function ClosesPage() {
  const closes = await serverFetch<DailyClose[]>("/api/daily-close");
  const rows = closes ?? [];
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{labels.admin.closes}</h1>
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.admin.empty.closes}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
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
                  <td className="px-3 py-2">{c.closeDate.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right">{formatKyat(c.openingCash)}</td>
                  <td className="px-3 py-2 text-right">{formatKyat(c.receivedTotal)}</td>
                  <td className="px-3 py-2 text-right">{formatKyat(c.paidOutTotal)}</td>
                  <td className="px-3 py-2 text-right">{formatKyat(c.expectedCash)}</td>
                  <td className="px-3 py-2 text-right">{formatKyat(c.countedCash)}</td>
                  <td className={"px-3 py-2 text-right font-semibold " + (c.difference < 0 ? "text-rose-600" : c.difference > 0 ? "text-emerald-600" : "")}>
                    {c.difference > 0 ? "+" : ""}{formatKyat(c.difference)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
