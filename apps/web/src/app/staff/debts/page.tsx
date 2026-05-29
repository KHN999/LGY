import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Customer } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const data = await serverFetch<Page<Customer>>("/api/customers?limit=200");
  const debtors = (data?.data ?? [])
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/staff" className="mb-4 inline-block rounded-lg border px-4 py-2">
        ← {labels.common.back}
      </Link>
      <h1 className="mb-4 text-center text-2xl font-bold">{labels.debts.title}</h1>
      {debtors.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.debts.none}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {debtors.map((c) => (
            <li key={c.id}>
              <Link
                href={`/staff/receive?customerId=${c.id}&customerName=${encodeURIComponent(c.name)}&balance=${c.balance}`}
                className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold">{c.name}</p>
                  {c.contact && (
                    <p className="text-sm text-muted-foreground truncate">{c.contact}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-rose-600">{formatKyat(c.balance)}</p>
                  <p className="text-xs text-muted-foreground">{labels.debts.clickToReceive}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
