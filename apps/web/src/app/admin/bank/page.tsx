import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { BANKS, bankLabel } from "@/lib/banks";
import { labels } from "@/lib/labels";
import { formatDate, formatDateTime, formatKyat } from "@/lib/utils";
import type { BankOverview, BankRow } from "@/lib/api-client";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { BankActions, RemoveBankTxn } from "./bank-actions";

export const dynamic = "force-dynamic";

const L = labels.bankBook;
const IN_COLOR = "#2a78d6";
const OUT_COLOR = "#eb6834";

const KIND: Record<BankRow["kind"], { icon: string; label: string }> = {
  CUSTOMER: { icon: "🧾", label: L.kindCustomer },
  SUPPLIER: { icon: "🏭", label: L.kindSupplier },
  TAILOR: { icon: "🧵", label: L.kindTailor },
  EXPENSE: { icon: "💸", label: L.kindExpense },
  DEPOSIT: { icon: "➕", label: L.kindDeposit },
  WITHDRAW: { icon: "➖", label: L.kindWithdraw },
  SET_BALANCE: { icon: "⚙️", label: L.kindSet },
};

function rowDetail(r: BankRow): string {
  const parts: string[] = [];
  if (r.kind === "DEPOSIT") parts.push(r.cashSide ? L.fromCash : L.outside);
  if (r.kind === "WITHDRAW") parts.push(r.cashSide ? L.toCash : L.outside);
  if (r.who) parts.push(r.who);
  if (r.notes) parts.push(r.notes);
  return parts.join(" · ");
}

export default async function AdminBankPage({
  searchParams,
}: {
  searchParams: Promise<{ bank?: string }>;
}) {
  const sp = await searchParams;
  const selected = sp.bank && (BANKS as readonly string[]).includes(sp.bank) ? sp.bank : null;
  const data = await serverFetch<BankOverview>(`/api/bank${selected ? `?bank=${selected}` : ""}`);

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={L.title} subtitle={L.subtitle} />
        <EmptyState>{labels.common.noData}</EmptyState>
      </div>
    );
  }

  const maxBalance = Math.max(1, ...data.accounts.map((a) => Math.abs(a.balance)));
  const hasUnassigned = data.unassigned.in > 0 || data.unassigned.out > 0;
  const balances = Object.fromEntries(data.accounts.map((a) => [a.bank, a.balance]));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L.title} subtitle={L.subtitle} />

      <section className="rounded-2xl border-2 border-foreground/70 bg-card p-4">
        <p className="text-sm text-muted-foreground">{L.total}</p>
        <p className="break-words text-3xl font-bold tabular-nums">{formatKyat(data.total)}</p>
        {data.accounts.some((a) => a.setAt === null) && (
          <p className="mt-1 text-xs text-muted-foreground">{L.totalHint}</p>
        )}
      </section>

      {/* one tile per bank — tap to see only that bank's movements */}
      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.accounts.map((a) => {
          const on = selected === a.bank;
          return (
            <Link
              key={a.bank}
              href={on ? "/admin/bank" : `/admin/bank?bank=${a.bank}`}
              prefetch={false}
              className={
                "flex min-w-0 flex-col gap-1.5 rounded-2xl border bg-card p-4 transition hover:bg-accent " +
                (on ? "border-2 border-primary" : "")
              }
            >
              <span className="flex items-center justify-between gap-2">
                <span className="font-semibold">🏛️ {bankLabel(a.bank)}</span>
                {a.setAt === null && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {L.notSet}
                  </span>
                )}
              </span>
              <span
                className={
                  "break-words text-2xl font-bold tabular-nums " +
                  (a.setAt === null ? "text-muted-foreground" : a.balance < 0 ? "text-destructive" : "")
                }
              >
                {formatKyat(a.balance)}
              </span>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Math.abs(a.balance) / maxBalance) * 100}%`,
                    background: a.balance < 0 ? OUT_COLOR : IN_COLOR,
                    opacity: a.setAt === null ? 0.4 : 1,
                  }}
                />
              </div>
              <span className="text-xs text-muted-foreground">
                {a.setAt === null
                  ? L.notSetHint
                  : `${L.setOn(formatDate(a.setAt))} · ${formatKyat(a.setAmount ?? 0)}`}
              </span>
              {a.setAt !== null && (a.in > 0 || a.out > 0) && (
                <span className="flex flex-wrap gap-x-3 text-xs tabular-nums text-muted-foreground">
                  <span>
                    {L.sinceIn} +{formatKyat(a.in)}
                  </span>
                  <span>
                    {L.sinceOut} −{formatKyat(a.out)}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
      </section>

      <BankActions defaultBank={selected} balances={balances} />

      {hasUnassigned && (
        <Card className="p-4">
          <h2 className="font-semibold">⚠️ {L.unassignedTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{L.unassignedHint}</p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm tabular-nums">
            <span>
              {labels.moneyBook.bankIn}: <b>{formatKyat(data.unassigned.in)}</b>
            </span>
            <span>
              {labels.moneyBook.bankOut}: <b>{formatKyat(data.unassigned.out)}</b>
            </span>
            <Link href="/admin/bank?bank=UNKNOWN" prefetch={false} className="underline underline-offset-2">
              {L.statement} →
            </Link>
          </div>
        </Card>
      )}

      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            {L.statement} — {selected ? bankLabel(selected) : L.all}
          </h2>
          {selected && (
            <Link href="/admin/bank" prefetch={false} className="text-sm underline underline-offset-2">
              {L.all}
            </Link>
          )}
        </div>
        {data.rows.length === 0 ? (
          <EmptyState>{L.noRows}</EmptyState>
        ) : (
          <ul className="divide-y rounded-2xl border bg-card">
            {data.rows.map((r) => {
              const k = KIND[r.kind] ?? { icon: "•", label: r.kind };
              const detail = rowDetail(r);
              const isSet = r.kind === "SET_BALANCE";
              return (
                <li key={r.key} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-semibold">
                      {k.icon} {k.label}
                      {!selected && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">
                          {bankLabel(r.bank)}
                        </span>
                      )}
                    </span>
                    {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                      {formatDateTime(r.date)}
                      {r.txnId !== null && <RemoveBankTxn id={r.txnId} />}
                    </span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end">
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: isSet ? undefined : r.signed >= 0 ? IN_COLOR : OUT_COLOR }}
                    >
                      {isSet ? `= ${formatKyat(r.amount)}` : `${r.signed >= 0 ? "+" : "−"}${formatKyat(r.amount)}`}
                    </span>
                    {r.balanceAfter !== null && !isSet && (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {L.balanceAfter} {formatKyat(r.balanceAfter)}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
