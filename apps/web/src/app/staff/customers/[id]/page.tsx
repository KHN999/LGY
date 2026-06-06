import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";
import type { Customer, Page, Sale, CustomerPayment } from "@/lib/api-client";

export const dynamic = "force-dynamic";

type Row = {
  kind: "sale" | "payment";
  date: string;
  amount: number;
  ref?: number;
  balanceAfter: number;
};

export default async function CustomerLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, salesPage, payments] = await Promise.all([
    serverFetch<Customer>(`/api/customers/${id}`),
    serverFetch<Page<Sale>>(`/api/sales?customerId=${id}&limit=200`),
    serverFetch<CustomerPayment[]>(`/api/customer-payments/by-customer/${id}`),
  ]);
  if (!customer) notFound();

  const sales = (salesPage?.data ?? []).filter((s) => !s.voidedAt);
  const pays = payments ?? [];
  const events = [
    ...sales.map((s) => ({ kind: "sale" as const, date: s.saleDate, amount: s.grandTotal, ref: s.id })),
    ...pays.map((p) => ({
      kind: "payment" as const,
      date: p.paymentDate,
      amount: p.amount,
      ref: p.saleId ?? undefined,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // "Balance after each event", anchored to the authoritative current balance
  // and walked backwards (a sale added debt, a payment reduced it).
  let bal = customer.balance;
  const rows: Row[] = events.map((e) => {
    const balanceAfter = bal;
    bal = e.kind === "sale" ? bal - e.amount : bal + e.amount;
    return { ...e, balanceAfter };
  });

  const owes = customer.balance > 0;

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/staff/debts" className="mb-4 inline-block rounded-lg border px-4 py-2">
        ← {labels.common.back}
      </Link>

      <div className="rounded-2xl border bg-card p-4 text-center">
        <h1 className="text-2xl font-bold">{customer.name}</h1>
        {customer.contact && <p className="text-sm text-muted-foreground">{customer.contact}</p>}
        <p className="mt-2 text-sm text-muted-foreground">{labels.debts.currentBalance}</p>
        <p
          className={
            "text-3xl font-extrabold tabular-nums " + (owes ? "text-rose-600" : "text-emerald-600")
          }
        >
          {formatKyat(customer.balance)}
        </p>
        {!owes && <p className="text-sm text-emerald-600">{labels.debts.settled}</p>}
      </div>

      <Link
        href={`/staff/receive?customerId=${customer.id}&customerName=${encodeURIComponent(customer.name)}&balance=${customer.balance}`}
        className="mt-4 block rounded-2xl bg-emerald-600 py-4 text-center text-xl font-bold text-white shadow active:scale-[0.98]"
      >
        💵 {labels.debts.receiveMoney}
      </Link>

      <h2 className="mb-2 mt-6 text-sm font-semibold text-muted-foreground">
        {labels.debts.ledgerTitle}
      </h2>
      {rows.length === 0 ? (
        <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.debts.noHistory}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((r, i) => {
            const isPay = r.kind === "payment";
            return (
              <li key={i} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {isPay ? "💵 " : "🧾 "}
                    {isPay ? labels.debts.paid : labels.debts.bought}
                    {r.kind === "sale" && r.ref ? ` #${r.ref}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.date)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={
                      "font-semibold tabular-nums " + (isPay ? "text-emerald-600" : "text-rose-600")
                    }
                  >
                    {isPay ? "−" : "+"}
                    {formatKyat(r.amount)}
                  </p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {labels.debts.rowBalance}: {formatKyat(r.balanceAfter)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
