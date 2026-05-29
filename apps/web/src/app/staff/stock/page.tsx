import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { StockRow } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function StaffStockPage() {
  const stock = await serverFetch<StockRow[]>("/api/inventory/stock?location=SHOP");
  const rows = (stock ?? []).filter((r) => r.qty !== 0);
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/staff" className="mb-4 inline-block rounded-lg border px-4 py-2">
        ← {labels.common.back}
      </Link>
      <h1 className="mb-4 text-center text-2xl font-bold">{labels.staff.viewStock}</h1>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.common.noData}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.itemTypeId}
              className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-5"
            >
              <span className="flex items-center gap-3">
                {r.emoji && <span className="text-4xl">{r.emoji}</span>}
                <span className="text-xl font-semibold">{r.labelMy}</span>
              </span>
              <span className="text-3xl font-bold tabular-nums">{r.qty}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
