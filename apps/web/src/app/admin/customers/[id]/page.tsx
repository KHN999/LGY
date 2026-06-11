import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { CustomerForm } from "../customer-form";
import { DeleteCustomerButton } from "../delete-customer-button";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate, yangonYmd } from "@/lib/utils";
import type { Customer, Page, Sale, CustomerPayment, CustomerReturnRow } from "@/lib/api-client";
import { PageHeader, Card } from "@/components/ui";
import { CustomerActivityChart } from "@/components/admin/customer-charts";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, salesPage, payments, returns] = await Promise.all([
    serverFetch<Customer>(`/api/customers/${id}`),
    serverFetch<Page<Sale>>(`/api/sales?customerId=${id}&limit=500`),
    serverFetch<CustomerPayment[]>(`/api/customer-payments/by-customer/${id}`),
    serverFetch<CustomerReturnRow[]>(`/api/returns/by-customer/${id}`),
  ]);
  if (!customer) notFound();

  const sales = salesPage?.data ?? [];
  const pays = payments ?? [];
  const rets = returns ?? [];

  // Activity per day: bought (on credit) vs paid vs returned.
  const map = new Map<string, { bought: number; paid: number; returned: number }>();
  const day = (k: string) =>
    map.get(k) ?? map.set(k, { bought: 0, paid: 0, returned: 0 }).get(k)!;
  for (const s of sales) day(yangonYmd(s.saleDate)).bought += s.grandTotal;
  for (const p of pays) day(yangonYmd(p.paymentDate)).paid += p.amount;
  for (const r of rets) day(yangonYmd(r.returnDate)).returned += r.returnTotal;
  const activity = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, v]) => ({ date: d.slice(5), bought: v.bought, paid: v.paid, returned: v.returned }));

  const paidTotal = pays.reduce((s, p) => s + p.amount, 0);
  const returnedTotal = rets.reduce((s, r) => s + r.returnTotal, 0);
  // Per-sale net return (goods value minus any cash refunded) so each sale's
  // "remaining" reflects returns and reconciles with the debt balance.
  const retBySale = new Map<number, { value: number; refund: number }>();
  for (const r of rets) {
    const e = retBySale.get(r.saleId) ?? { value: 0, refund: 0 };
    e.value += r.returnTotal;
    e.refund += r.refundAmount;
    retBySale.set(r.saleId, e);
  }
  const balTone =
    customer.balance > 0 ? "text-rose-600" : customer.balance < 0 ? "text-emerald-600" : "";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/admin/customers"
        backLabel={labels.admin.customers}
        title={customer.name}
        subtitle={customer.contact ?? undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.domain.debt}</p>
          <p className={"mt-1 text-2xl font-bold tabular-nums " + balTone}>
            {formatKyat(Math.abs(customer.balance))}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.salesAdmin.title}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{sales.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.customerDetail.paid}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatKyat(paidTotal)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.customerDetail.returned}</p>
          <p
            className={
              "mt-1 text-2xl font-bold tabular-nums " + (returnedTotal > 0 ? "text-amber-600" : "")
            }
          >
            {formatKyat(returnedTotal)}
          </p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.activity}</h2>
        <CustomerActivityChart data={activity} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.recentSales}</h2>
          {sales.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {labels.customerDetail.noSales}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {sales.slice(0, 12).map((s) => {
                const ret = retBySale.get(s.id);
                // Net return (goods value − cash refunded) reduces what's still owed.
                const remaining = s.grandTotal - s.paidAmount - (ret ? ret.value - ret.refund : 0);
                return (
                  <li key={s.id}>
                    <Link
                      href={`/admin/sales/${s.id}`}
                      className="flex items-center justify-between gap-2 rounded-lg px-1 py-2 hover:bg-accent"
                    >
                      <span className="text-sm">
                        #{s.id} · {formatDate(s.saleDate)}
                        {s.voidedAt ? ` · ${labels.salesAdmin.voided}` : ""}
                      </span>
                      <span className="shrink-0 text-right text-sm">
                        <span
                          className={
                            "font-medium tabular-nums " +
                            (s.voidedAt ? "text-muted-foreground line-through" : "")
                          }
                        >
                          {formatKyat(s.grandTotal)}
                        </span>
                        {!s.voidedAt && remaining > 0 && (
                          <span className="ml-2 text-xs text-rose-600">
                            ({formatKyat(remaining)})
                          </span>
                        )}
                        {!s.voidedAt && ret && (
                          <span className="ml-2 text-xs text-amber-600">
                            ↩ {formatKyat(ret.value)}
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.recentPayments}</h2>
          {pays.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {labels.customerDetail.noPayments}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {pays.slice(0, 12).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm">
                    {formatDate(p.paymentDate)} · {p.method}
                  </span>
                  <span className="text-sm font-medium tabular-nums text-emerald-700">
                    {formatKyat(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {rets.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.recentReturns}</h2>
          <ul className="flex flex-col divide-y">
            {rets.slice(0, 12).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm">
                  {formatDate(r.returnDate)} · {labels.returnsAdmin.sale} #{r.saleId}
                </span>
                <span className="shrink-0 text-right text-sm">
                  <span className="font-medium tabular-nums text-amber-700">
                    {formatKyat(r.returnTotal)}
                  </span>
                  {r.refundAmount > 0 && (
                    <span className="ml-2 text-xs text-rose-600">
                      ({labels.returnsAdmin.refund} {formatKyat(r.refundAmount)})
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">{labels.common.edit}</summary>
        <div className="mt-3 flex flex-col gap-4">
          <CustomerForm initial={customer} />
          <DeleteCustomerButton id={customer.id} />
        </div>
      </details>
    </div>
  );
}
