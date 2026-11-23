import type { ReactNode } from "react";
import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { bankLabel } from "@/lib/banks";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { MoneyOverview } from "@/lib/api-client";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { MoneyRange } from "./money-range";
import { BalanceArea, InOutBars, IN_COLOR, OUT_COLOR } from "./money-charts";

export const dynamic = "force-dynamic";

const L = labels.moneyBook;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
const YGN_OFFSET_MS = 390 * 60_000;
/** YYYY-MM-DD → DD/MM/YYYY */
const dmy = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
const signed = (v: number) => (v > 0 ? "+" : "") + formatKyat(v);

function channelName(channel: string) {
  if (channel === "CASH") return `💵 ${L.cash}`;
  if (channel === "NOBANK") return `🏦 ${labels.receive.bankNotRecorded}`;
  return `🏦 ${bankLabel(channel)}`;
}

/** One step of the opening + in − out = closing strip. */
function Step({
  label,
  hint,
  value,
  color,
  strong,
  children,
}: {
  label: string;
  hint?: string;
  value: string;
  color?: string;
  strong?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={
        "flex min-w-0 flex-col gap-1 rounded-2xl border p-4 " +
        (strong ? "border-2 border-foreground/70 bg-card" : "bg-card")
      }
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        {color && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />}
        {label}
      </span>
      <span className={"break-words font-bold tabular-nums " + (strong ? "text-2xl" : "text-xl")}>{value}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      {children}
    </div>
  );
}

/** Two-part bar: how a total splits between cash and bank. */
function SplitBar({ cash, bank, color }: { cash: number; bank: number; color: string }) {
  const c = Math.max(0, cash);
  const b = Math.max(0, bank);
  const sum = c + b;
  return (
    <div className="mt-1 flex flex-col gap-1">
      {sum > 0 && (
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          <span style={{ width: `${(c / sum) * 100}%`, background: color }} />
          <span style={{ width: `${(b / sum) * 100}%`, background: color, opacity: 0.45 }} />
        </div>
      )}
      <div className="flex flex-wrap justify-between gap-x-3 text-xs tabular-nums text-muted-foreground">
        <span>
          💵 {L.cash} {formatKyat(cash)}
        </span>
        <span>
          🏦 {L.bank} {formatKyat(bank)}
        </span>
      </div>
    </div>
  );
}

/** Ranked horizontal bars: label, amount, share of the total. */
function ShareBars({
  rows,
  color,
}: {
  rows: { label: string; value: number; note?: string }[];
  color: string;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (total <= 0) return <p className="py-6 text-center text-sm text-muted-foreground">{L.noMovement}</p>;
  return (
    <ul className="flex flex-col gap-3">
      {rows
        .filter((r) => r.value > 0)
        .map((r) => (
          <li key={r.label} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{r.label}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatKyat(r.value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
            </div>
            <span className="text-xs tabular-nums text-muted-foreground">
              {Math.round((r.value / total) * 100)}%{r.note ? ` · ${r.note}` : ""}
            </span>
          </li>
        ))}
    </ul>
  );
}

/** Amount with a thin bar scaled against the busiest day. */
function FlowCell({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground sm:hidden">{label}</span>
      <span className="text-sm tabular-nums">{value > 0 ? formatKyat(value) : "—"}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
    </div>
  );
}

export default async function AdminMoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; range?: string; view?: string }>;
}) {
  const sp = await searchParams;
  // Default: the last 30 days (Yangon), so the first paint already shows a trend.
  const today = new Date(Date.now() + YGN_OFFSET_MS).toISOString().slice(0, 10);
  const defFrom = new Date(Date.now() + YGN_OFFSET_MS - 29 * 86_400_000).toISOString().slice(0, 10);
  const hasRange = !!sp.from && YMD.test(sp.from) && !!sp.to && YMD.test(sp.to);
  const from = hasRange ? sp.from! : defFrom;
  const to = hasRange ? sp.to! : today;
  const active = hasRange ? (sp.range ?? "custom") : "30";
  // Cash only by default: bank money lands straight in the account, so the
  // number to check against staff hands is cash in minus cash out.
  const view: "cash" | "bank" | "all" = sp.view === "all" ? "all" : sp.view === "bank" ? "bank" : "cash";
  const cashOnly = view === "cash";
  const bankOnly = view === "bank";

  const data = await serverFetch<MoneyOverview>(`/api/dashboard/money?from=${from}&to=${to}`);

  if (!data) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={L.title} subtitle={L.subtitle} />
        <MoneyRange from={from} to={to} active={active} firstDay={null} view={view} />
        <EmptyState>{labels.common.noData}</EmptyState>
      </div>
    );
  }

  const { totals } = data;
  // One shape for both views, so everything below reads the same fields.
  const days = data.days.map((d) =>
    cashOnly
      ? { date: d.date, in: d.inCash, out: d.outCash, net: d.inCash - d.outCash, closing: d.closingCash }
      : bankOnly
        ? { date: d.date, in: d.inBank, out: d.outBank, net: d.inBank - d.outBank, closing: d.closingBank }
        : { date: d.date, in: d.in, out: d.out, net: d.net, closing: d.closing },
  );
  const pick = (cash: number, all: number) => (cashOnly ? cash : bankOnly ? all - cash : all);
  const sumIn = pick(totals.inCash, totals.in);
  const sumOut = pick(totals.outCash, totals.out);
  const balance = cashOnly ? data.closing.cash : bankOnly ? data.closing.bank : data.closing.total;
  const inLabel = cashOnly ? L.cashIn : bankOnly ? L.bankIn : L.moneyIn;
  const outLabel = cashOnly ? L.cashOut : bankOnly ? L.bankOut : L.moneyOut;
  const balanceLabel = cashOnly ? L.cashBalance : bankOnly ? L.bankBalance : L.closing;
  const maxFlow = Math.max(1, ...days.map((d) => Math.max(d.in, d.out)));
  const moved = days.filter((d) => d.in > 0 || d.out > 0);
  const best = moved.reduce<(typeof days)[number] | null>((m, d) => (!m || d.in > m.in ? d : m), null);
  const worst = moved.reduce<(typeof days)[number] | null>((m, d) => (!m || d.out > m.out ? d : m), null);
  const daysUp = days.filter((d) => d.net > 0).length;
  const daysDown = days.filter((d) => d.net < 0).length;

  const outRows = [
    { label: `🏭 ${L.supplier}`, value: pick(totals.supplierCash, totals.supplier) },
    { label: `🧵 ${L.tailor}`, value: pick(totals.tailorCash, totals.tailor) },
    // Expenses broken out by category, so the biggest costs are visible by name.
    ...(data.expenseCategories.length > 0
      ? data.expenseCategories.map((c) => ({ label: `💸 ${c.name}`, value: pick(c.cash ?? c.value, c.value) }))
      : [{ label: `💸 ${L.expense}`, value: pick(totals.expenseCash ?? totals.expense, totals.expense) }]),
    // Refunds are always cash.
    { label: `↩️ ${L.refund}`, value: pick(totals.refund, totals.refund) },
  ].sort((a, b) => b.value - a.value);
  const bankChannels = data.channels.filter((c) => c.channel !== "CASH");
  const inRows = cashOnly
    ? [
        { label: `🧾 ${L.fromSales}`, value: totals.inSaleCash },
        { label: `📒 ${L.fromDebt}`, value: totals.inDebtCash },
      ]
    : (bankOnly ? bankChannels : data.channels).map((c) => ({
        label: channelName(c.channel),
        value: c.total,
        note: `${c.count.toLocaleString("en-US")} ${L.times}`,
      }));
  const viewHref = (v: "cash" | "bank" | "all") =>
    `/admin/money?range=${active}&from=${data.from}&to=${data.to}${v === "cash" ? "" : `&view=${v}`}`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={L.title} subtitle={L.subtitle} />
      <MoneyRange from={data.from} to={data.to} active={active} firstDay={data.firstDay} view={view} />

      <nav className="flex flex-wrap gap-2">
        {(["cash", "bank", "all"] as const).map((v) => (
          <Link
            key={v}
            href={viewHref(v)}
            aria-current={view === v ? "true" : undefined}
            className={
              "rounded-lg px-3 py-1.5 text-sm font-semibold " +
              (view === v ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
            }
          >
            {v === "cash" ? `💵 ${L.viewCash}` : v === "bank" ? `🏦 ${L.viewBank}` : `💵+🏦 ${L.viewAll}`}
          </Link>
        ))}
      </nav>

      {/* in − out = balance, for the selected period only */}
      <section className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-[1fr_auto_1fr_auto_1.15fr] xl:items-stretch">
        <Step
          label={inLabel}
          value={formatKyat(sumIn)}
          color={IN_COLOR}
          hint={
            cashOnly
              ? L.bankLeftOut(formatKyat(totals.inBank))
              : bankOnly
                ? L.cashLeftOut(formatKyat(totals.inCash))
                : undefined
          }
        >
          {view === "all" && <SplitBar cash={totals.inCash} bank={totals.inBank} color={IN_COLOR} />}
        </Step>
        <span className="hidden self-center text-2xl font-bold text-muted-foreground xl:block">−</span>
        <Step
          label={outLabel}
          value={formatKyat(sumOut)}
          color={OUT_COLOR}
          hint={
            cashOnly
              ? L.bankLeftOut(formatKyat(totals.outBank))
              : bankOnly
                ? L.cashLeftOut(formatKyat(totals.outCash))
                : undefined
          }
        >
          {view === "all" && <SplitBar cash={totals.outCash} bank={totals.outBank} color={OUT_COLOR} />}
        </Step>
        <span className="hidden self-center text-2xl font-bold text-muted-foreground xl:block">=</span>
        <Step
          label={balanceLabel}
          hint={L.closingHint(dmy(data.from), dmy(data.to))}
          value={formatKyat(balance)}
          strong
        />
      </section>

      {/* quick facts */}
      <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{L.bestDay}</p>
          <p className="font-bold tabular-nums">{best && best.in > 0 ? formatKyat(best.in) : "—"}</p>
          <p className="text-xs text-muted-foreground">{best && best.in > 0 ? dmy(best.date) : ""}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{L.worstDay}</p>
          <p className="font-bold tabular-nums">{worst && worst.out > 0 ? formatKyat(worst.out) : "—"}</p>
          <p className="text-xs text-muted-foreground">{worst && worst.out > 0 ? dmy(worst.date) : ""}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{L.daysUp}</p>
          <p className="font-bold tabular-nums">
            ▲ {daysUp} <span className="text-xs font-normal text-muted-foreground">{L.of} {days.length}</span>
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">{L.daysDown}</p>
          <p className="font-bold tabular-nums">
            ▼ {daysDown} <span className="text-xs font-normal text-muted-foreground">{L.of} {days.length}</span>
          </p>
        </Card>
      </section>

      {days.length > 1 && (
        <section className="flex flex-col gap-4">
          <Card className="min-w-0 p-4">
            <h2 className="mb-2 font-semibold">{L.inVsOut}</h2>
            <InOutBars data={days.map((d) => ({ date: d.date, in: d.in, out: d.out }))} />
          </Card>
          <Card className="min-w-0 p-4">
            <h2 className="mb-2 font-semibold">{L.balanceByDay}</h2>
            <BalanceArea data={days.map((d) => ({ date: d.date, closing: d.closing }))} />
          </Card>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="min-w-0 p-4">
          <h2 className="mb-3 font-semibold">{L.whereFrom}</h2>
          <ShareBars color={IN_COLOR} rows={inRows} />
          {cashOnly && bankChannels.length > 0 && (
            <div className="mt-4 border-t pt-3">
              <p className="mb-2 text-xs text-muted-foreground">{L.bankDirect}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {bankChannels.map((c) => (
                  <li key={c.channel} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">{channelName(c.channel)}</span>
                    <span className="shrink-0 tabular-nums">{formatKyat(c.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {view === "all" && totals.in > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">{L.fromSales}</p>
                <p className="font-semibold tabular-nums">{formatKyat(totals.inSale)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{L.fromDebt}</p>
                <p className="font-semibold tabular-nums">{formatKyat(totals.inDebt)}</p>
              </div>
            </div>
          )}
        </Card>
        <Card className="min-w-0 p-4">
          <h2 className="mb-3 font-semibold">{L.whereTo}</h2>
          <ShareBars color={OUT_COLOR} rows={outRows} />
        </Card>
      </section>

      {/* day by day, newest first */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">{L.daily}</h2>
        <div className="rounded-2xl border bg-card">
          <div className="hidden grid-cols-[6.5rem_1fr_1fr_10rem] gap-3 border-b px-4 py-2 text-xs text-muted-foreground sm:grid">
            <span>{L.date}</span>
            <span>{inLabel}</span>
            <span>{outLabel}</span>
            <span className="text-right">{balanceLabel}</span>
          </div>
          <ul className="divide-y">
            {[...days].reverse().map((d) => (
              <li
                key={d.date}
                className="grid grid-cols-2 gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[6.5rem_1fr_1fr_10rem] sm:items-center"
              >
                <span className="text-sm font-semibold tabular-nums">{dmy(d.date)}</span>
                <div className="flex flex-col items-end sm:order-last">
                  <span className="font-bold tabular-nums">{formatKyat(d.closing)}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {d.net === 0 ? L.noMovement : `${d.net > 0 ? "▲" : "▼"} ${signed(d.net)}`}
                  </span>
                </div>
                <FlowCell label={inLabel} value={d.in} max={maxFlow} color={IN_COLOR} />
                <FlowCell label={outLabel} value={d.out} max={maxFlow} color={OUT_COLOR} />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Card className="p-4">
        <h2 className="mb-2 font-semibold">{L.noteTitle}</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
          {[...(cashOnly ? [L.cashNote] : bankOnly ? [L.bankNote] : []), ...L.notes].map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
