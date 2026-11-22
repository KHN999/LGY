import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser, hasRole, serverFetch } from "@/lib/auth-server";
import type { AnalyticsOverview, ShopState } from "@/lib/api-client";
import { formatDate, formatDateTime, formatKyat } from "@/lib/utils";
import { OneBar, TwoBars } from "./charts";
import { BANKS, WEEKDAYS, lakh, pct, t } from "./text.my";

export const dynamic = "force-dynamic";

type Tone = "bad" | "warn" | "info" | "good";
const TONE: Record<Tone, string> = {
  bad: "border-rose-300 bg-rose-50 text-rose-950",
  warn: "border-amber-300 bg-amber-50 text-amber-950",
  info: "border-slate-200 bg-card",
  good: "border-emerald-300 bg-emerald-50 text-emerald-950",
};
const num = (v: number) => Math.round(v).toLocaleString("en-US");
const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((s, r) => s + f(r), 0);

/** Turn the figures into plain-language findings, most important first. */
function findings(o: AnalyticsOverview): { tone: Tone; text: string }[] {
  const out: { tone: Tone; text: string }[] = [];
  const f = t.f;
  out.push({
    tone: "info",
    text: f.scale(lakh(o.totals.revenue), o.totals.saleDays, lakh(o.totals.revenuePerDay), o.totals.orders, lakh(o.totals.avgOrder)),
  });

  // Last 4 weeks against the 4 before. Orders are the steadier signal; a single
  // very large invoice can swing revenue.
  if (o.weekly.length >= 8) {
    const last = o.weekly.slice(-4);
    const prev = o.weekly.slice(-8, -4);
    const lo = sum(last, (w) => w.orders);
    const po = sum(prev, (w) => w.orders);
    const lr = sum(last, (w) => w.revenue);
    const pr = sum(prev, (w) => w.revenue);
    if (po > 0 && pr > 0) {
      const dOrders = (lo - po) / po;
      const dRev = (lr - pr) / pr;
      if (dOrders <= -0.15) out.push({ tone: "bad", text: f.trendDown(pct(-dOrders), pct(-dRev)) });
      else if (dOrders >= 0.15) out.push({ tone: "good", text: f.trendUp(pct(dOrders), pct(dRev)) });
    }
  }

  const r = o.receivables;
  if (r.deleted.unpaid > 0) out.push({ tone: "bad", text: f.deleted(lakh(r.deleted.unpaid), r.deleted.unpaidCount) });

  const top = o.products[0];
  if (top && top.share >= 0.4) {
    out.push({ tone: "warn", text: f.topProduct(top.label, pct(top.share), top.marginPct != null ? pct(top.marginPct) : null) });
  }
  if (o.profit.marginPct != null) {
    out.push({
      tone: o.profit.marginPct < 0.12 ? "warn" : "info",
      text: f.margin(pct(o.profit.marginPct), lakh(o.profit.grossProfit), pct(o.profit.costedShare)),
    });
  }
  if (o.hygiene.expenses < 10 || o.profit.tailorCharged === 0) {
    out.push({ tone: "warn", text: f.noExpenses(o.hygiene.expenses) });
  }
  if (o.hygiene.saleDays > 0 && o.hygiene.closedSaleDays / o.hygiene.saleDays < 0.5) {
    out.push({ tone: "warn", text: f.closes(o.hygiene.closedSaleDays, o.hygiene.saleDays) });
  }
  if (o.customers.top5Share >= 0.2) {
    out.push({ tone: "warn", text: f.concentration(pct(o.customers.top5Share), pct(o.customers.top1Share)) });
  }
  if (o.customers.buyers > 0) {
    out.push({ tone: "info", text: f.churn(o.customers.oneOrder, o.customers.buyers, o.customers.active30) });
  }
  if (r.total > 0) {
    out.push({
      tone: r.aging.d90plus.amount > 0 ? "warn" : "info",
      text: f.receivable(lakh(r.total), r.debtors, lakh(r.aging.d90plus.amount), r.aging.d90plus.count),
    });
  }
  if (r.inCredit.amount > 0) out.push({ tone: "warn", text: f.inCredit(lakh(r.inCredit.amount), r.inCredit.count) });

  // Bank share of collections: last 3 months against the months before.
  if (o.monthly.length >= 4) {
    const share = (rows: typeof o.monthly) => {
      const c = sum(rows, (m) => m.collected);
      return c > 0 ? sum(rows, (m) => m.bank) / c : 0;
    };
    const recent = share(o.monthly.slice(-3));
    const early = share(o.monthly.slice(0, -3));
    if (recent - early >= 0.1) out.push({ tone: "info", text: f.bankShift(pct(recent), pct(early)) });
  }

  const sold30Cost = sum(o.products, (p) => (p.costPrice ?? 0) * p.qty30);
  if (sold30Cost > 0) {
    out.push({ tone: "info", text: f.stockDays(lakh(o.stock.totals.totalValue), (o.stock.totals.totalValue / sold30Cost) * 30) });
  }
  const stockout = o.products.filter((p) => p.qty30 > 0 && p.onHand <= 0).map((p) => p.label);
  if (stockout.length) out.push({ tone: "warn", text: f.stockout(stockout.slice(0, 4).join("၊ ")) });
  const over = o.products.filter((p) => (p.daysCover ?? 0) > 180 && p.onHand * (p.costPrice ?? 0) > 5_000_000);
  if (over[0]) out.push({ tone: "warn", text: f.overstock(over[0].label, over[0].daysCover ?? 0) });
  if (o.stock.idleValue > 0 && o.stock.idle[0]) {
    out.push({ tone: "info", text: f.idle(lakh(o.stock.idleValue), o.stock.idle[0].label) });
  }
  const below = o.products.filter((p) => p.belowCost).map((p) => p.label);
  if (below.length) out.push({ tone: "warn", text: f.belowCost(below.join("၊ ")) });
  if (o.payables.supplierOwed > 0) out.push({ tone: "info", text: f.supplier(lakh(o.payables.supplierOwed)) });
  if (o.hygiene.sales > 0 && o.hygiene.voidedSales / o.hygiene.sales >= 0.08) {
    out.push({ tone: "warn", text: f.voided(pct(o.hygiene.voidedSales / o.hygiene.sales)) });
  }
  const order: Tone[] = ["bad", "warn", "info", "good"];
  return [out[0], ...out.slice(1).sort((a, b) => order.indexOf(a.tone) - order.indexOf(b.tone))];
}

export default async function DataAnalysisPage() {
  const [user, shopState] = await Promise.all([getCurrentUser(), serverFetch<ShopState>("/api/shop")]);
  if (!user) redirect("/login?redirect=/data-analysis");
  if (!hasRole(user, "admin")) redirect("/staff");

  const o = await serverFetch<AnalyticsOverview>("/api/analytics/overview");
  const shopLabel = shopState?.shop === "playground" ? t.shopTest : t.shopMain;

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-4 pb-16 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link href="/admin" className="rounded-lg border px-3 py-1.5">← {t.back}</Link>
          <Link href="/explain" className="rounded-lg border px-3 py-1.5">{t.explainLink} →</Link>
        </div>
        <h1 className="text-2xl font-bold">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.shopNote(shopLabel)}</p>
        {o && o.period.from && o.period.to && (
          <p className="text-sm text-muted-foreground">
            {t.period(formatDate(o.period.from), formatDate(o.period.to), o.totals.saleDays)}
            <br />
            {t.generated(formatDateTime(o.generatedAt))}
          </p>
        )}
      </header>

      {!o ? (
        <p role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-900">{t.loadFailed}</p>
      ) : o.totals.orders === 0 ? (
        <p className="rounded-xl border p-6 text-center text-muted-foreground">{t.noData}</p>
      ) : (
        <Report o={o} />
      )}
    </main>
  );
}

function Report({ o }: { o: AnalyticsOverview }) {
  const c = t.col;
  const maxDow = Math.max(...o.weekdays.map((d) => d.revenue), 1);
  const mixTotal = sum(o.payments.mix, (m) => m.total) || 1;
  const h = o.hygiene;
  const hyg: { text: string; why?: string }[] = [];
  if (h.saleDays > 0 && h.closedSaleDays < h.saleDays) hyg.push({ text: t.hyg.closes(h.closedSaleDays, h.saleDays), why: t.hyg.closesWhy });
  if (h.closesOff > 0) hyg.push({ text: t.hyg.closeDiff(h.closesOff, formatKyat(h.closeDiff)) });
  if (h.voidedSales > 0) hyg.push({ text: t.hyg.voided(h.voidedSales, h.sales, pct(h.voidedSales / h.sales)), why: t.hyg.voidedWhy });
  hyg.push({ text: t.hyg.expenses(h.expenses), why: t.hyg.expensesWhy });
  if (o.payables.tailorCharged === 0) hyg.push({ text: t.pay.tailorNone });
  if (h.openExceptions > 0) hyg.push({ text: t.hyg.exceptions(h.openExceptions), why: t.hyg.exceptionsWhy });
  if (h.uncostedItems > 0) hyg.push({ text: t.hyg.uncosted(h.uncostedItems), why: t.hyg.uncostedWhy });
  if (o.nonCatalog.lines > 0) hyg.push({ text: t.hyg.nonCatalog(o.nonCatalog.lines, lakh(o.nonCatalog.revenue)), why: t.hyg.nonCatalogWhy });
  if (h.returns > 0) hyg.push({ text: t.hyg.returns(h.returns, formatKyat(h.returnTotal)) });

  return (
    <>
      <Section title={t.findings} note={t.findingsNote}>
        <ul className="flex flex-col gap-2">
          {findings(o).map((x, i) => (
            <li key={i} className={`rounded-xl border px-4 py-3 leading-relaxed ${TONE[x.tone]}`}>{x.text}</li>
          ))}
        </ul>
      </Section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={t.kpi.revenue} value={lakh(o.totals.revenue)} />
        <Kpi label={t.kpi.perDay} value={lakh(o.totals.revenuePerDay)} />
        <Kpi label={t.kpi.orders} value={num(o.totals.orders)} />
        <Kpi label={t.kpi.avgOrder} value={lakh(o.totals.avgOrder)} />
        <Kpi label={t.kpi.collected} value={lakh(o.totals.collected)} />
        <Kpi label={t.kpi.receivable} value={lakh(o.receivables.total)} />
        <Kpi label={t.kpi.supplierOwed} value={lakh(o.payables.supplierOwed)} />
        <Kpi label={t.kpi.stockValue} value={lakh(o.stock.totals.totalValue)} />
      </div>

      <Section title={t.s.monthly} note={t.s.monthlyNote}>
        <TwoBars
          data={o.monthly.map((m) => ({ label: m.month, a: m.revenue, b: m.collected }))}
          aName={c.revenue}
          bName={c.collected}
          unitNote="သိန်း"
        />
        <Table
          head={[c.month, c.orders, c.days, c.revenue, c.perDay, c.collected, c.debtCollected, c.bankShare]}
          rows={o.monthly.map((m) => [
            m.month,
            num(m.orders),
            num(m.days),
            lakh(m.revenue),
            m.days > 0 ? lakh(m.revenue / m.days) : t.never,
            lakh(m.collected),
            lakh(m.debtCollected),
            m.collected > 0 ? pct(m.bank / m.collected) : t.never,
          ])}
        />
      </Section>

      <Section title={t.s.weekly}>
        <OneBar
          data={o.weekly.map((w) => ({ label: formatDate(w.week).slice(0, 5), a: w.revenue }))}
          name={c.revenue}
          unitNote="သိန်း"
        />
        <Table
          head={[c.week, c.orders, c.revenue]}
          rows={o.weekly.map((w) => [formatDate(w.week), num(w.orders), lakh(w.revenue)])}
        />
      </Section>

      <Section title={t.s.weekday}>
        <ul className="flex flex-col gap-1.5">
          {o.weekdays.map((d) => (
            <li key={d.dow} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 text-sm">
              <span>{WEEKDAYS[d.dow]}</span>
              <span className="h-3 overflow-hidden rounded bg-muted">
                <span className="block h-full rounded bg-emerald-500" style={{ width: `${(d.revenue / maxDow) * 100}%` }} />
              </span>
              <span className="tabular-nums text-muted-foreground">
                {lakh(d.revenue)} · {num(d.orders)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.s.products} note={t.s.productsNote}>
        <Table
          head={[c.item, c.qty, c.revenue, c.share, c.avgPrice, c.cost, c.margin, c.sold30, c.onHand, c.atTailors, c.daysCover]}
          rows={o.products.map((p) => [
            p.label,
            num(p.qty),
            lakh(p.revenue),
            pct(p.share),
            num(p.avgPrice),
            p.costPrice != null ? num(p.costPrice) : t.never,
            p.marginPct != null ? <Mark key="m" bad={p.belowCost}>{pct(p.marginPct)}</Mark> : t.never,
            num(p.qty30),
            <Mark key="s" bad={p.onHand <= 0 && p.qty30 > 0}>{p.onHand <= 0 && p.qty30 > 0 ? t.outOfStock : num(p.onHand)}</Mark>,
            p.atTailors ? num(p.atTailors) : t.never,
            p.daysCover != null && p.daysCover >= 0 ? `${num(p.daysCover)} ${t.daysUnit}` : p.onHand > 0 ? t.noSales30 : t.never,
          ])}
        />
      </Section>

      <Section title={t.s.profit} note={t.profit.note}>
        <Pairs
          rows={[
            [t.profit.costedRevenue, `${lakh(o.profit.costedRevenue)} (${pct(o.profit.costedShare)})`],
            [t.profit.gross, lakh(o.profit.grossProfit)],
            [t.profit.margin, o.profit.marginPct != null ? pct(o.profit.marginPct) : t.never],
            [t.profit.expenses, `${formatKyat(o.profit.expenseTotal)} (${num(o.profit.expenses)})`],
            [t.profit.tailor, formatKyat(o.profit.tailorCharged)],
          ]}
        />
      </Section>

      <Section title={t.s.customers}>
        <Pairs
          rows={[
            [t.cust.total, num(o.customers.total)],
            [t.cust.buyers, num(o.customers.buyers)],
            [t.cust.active30, num(o.customers.active30)],
            [t.cust.active90, num(o.customers.active90)],
            [t.cust.oneOrder, num(o.customers.oneOrder)],
            [`${t.cust.top1} — ${t.cust.ofRevenue}`, pct(o.customers.top1Share)],
            [`${t.cust.top5} — ${t.cust.ofRevenue}`, pct(o.customers.top5Share)],
            [`${t.cust.top20} — ${t.cust.ofRevenue}`, pct(o.customers.top20Share)],
            [`${t.cust.walkin} — ${t.cust.ofRevenue}`, o.totals.revenue > 0 ? pct(o.totals.walkinRevenue / o.totals.revenue) : t.never],
          ]}
        />
        <h3 className="mt-2 text-sm font-semibold">{t.cust.top10}</h3>
        <Table
          head={[c.customer, c.orders, c.revenue, c.balance, c.lastSale]}
          rows={o.customers.top.map((x) => [
            <Link key="l" href={`/admin/customers/${x.id}`} className="underline">{x.name}</Link>,
            num(x.orders),
            lakh(x.revenue),
            x.balance > 0 ? formatKyat(x.balance) : t.never,
            x.lastSale ? formatDate(x.lastSale) : t.never,
          ])}
        />
      </Section>

      <Section title={t.s.receivables} note={t.s.receivablesNote}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {(["d0_30", "d31_60", "d61_90", "d90plus"] as const).map((k) => (
            <Kpi key={k} label={t.aging[k]} value={lakh(o.receivables.aging[k].amount)} sub={t.agingPeople(o.receivables.aging[k].count)} />
          ))}
        </div>
        <h3 className="mt-2 text-sm font-semibold">{t.recv.top}</h3>
        <Table
          head={[c.customer, c.balance, c.lastSale, c.lastPayment, c.daysSince]}
          rows={o.receivables.top.map((x) => [
            <Link key="l" href={`/admin/customers/${x.id}`} className="underline">{x.name}</Link>,
            formatKyat(x.balance),
            x.lastSale ? formatDate(x.lastSale) : t.never,
            x.lastPayment ? formatDate(x.lastPayment) : t.never,
            x.daysSincePayment != null ? <Mark key="d" bad={x.daysSincePayment > 90}>{num(x.daysSincePayment)}</Mark> : t.never,
          ])}
        />
        {o.receivables.inCredit.count > 0 && (
          <Note tone="warn">{t.recv.inCredit(o.receivables.inCredit.count, formatKyat(o.receivables.inCredit.amount))}</Note>
        )}
        {o.receivables.deleted.unpaid > 0 && (
          <Note tone="bad">{t.recv.deleted(o.receivables.deleted.unpaidCount, formatKyat(o.receivables.deleted.unpaid))}</Note>
        )}
      </Section>

      <Section title={t.s.payables}>
        <h3 className="text-sm font-semibold">{t.pay.suppliers}</h3>
        <Pairs
          rows={[
            [t.pay.ordered, lakh(o.payables.supplierOrdered)],
            [t.pay.paid, lakh(o.payables.supplierPaid)],
            [t.pay.owed, formatKyat(o.payables.supplierOwed)],
          ]}
        />
        <h3 className="mt-2 text-sm font-semibold">{t.pay.tailors}</h3>
        {o.payables.tailorCharged === 0 ? (
          <Note tone="warn">{t.pay.tailorNone}</Note>
        ) : (
          <Pairs
            rows={[
              [t.pay.charged, formatKyat(o.payables.tailorCharged)],
              [t.pay.paid, formatKyat(o.payables.tailorPaid)],
              [t.pay.owed, formatKyat(o.payables.tailorOwed)],
            ]}
          />
        )}
      </Section>

      <Section title={t.s.payMix}>
        <Table
          head={[c.method, c.count, c.amount, c.share]}
          rows={o.payments.mix.map((m) => [
            m.method === "BANK_TRANSFER"
              ? `${t.methods[m.method]} · ${m.bank ? (BANKS[m.bank] ?? m.bank) : t.bankNotRecorded}`
              : (t.methods[m.method] ?? m.method),
            num(m.count),
            lakh(m.total),
            pct(m.total / mixTotal),
          ])}
        />
      </Section>

      <Section title={t.s.stock}>
        <Pairs
          rows={[
            [c.warehouse, lakh(o.stock.totals.warehouseValue)],
            [c.shop, lakh(o.stock.totals.shopValue)],
            [c.atTailors, lakh(o.stock.totals.tailorValue)],
            [c.total, lakh(o.stock.totals.totalValue)],
          ]}
        />
        {o.stock.idle.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-semibold">{t.stock.idle}</h3>
            <p className="text-xs text-muted-foreground">{t.stock.idleNote}</p>
            <Table head={[c.item, c.qty, c.value]} rows={o.stock.idle.map((x) => [x.label, num(x.qty), lakh(x.value)])} />
          </>
        )}
        {o.stock.negative.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-semibold">{t.stock.negative}</h3>
            <Table
              head={[c.item, c.warehouse, c.shop]}
              rows={o.stock.negative.map((x) => [x.label, num(x.warehouseQty), num(x.shopQty)])}
            />
          </>
        )}
      </Section>

      <Section title={t.s.flow} note={t.s.flowNote}>
        <Table
          head={[c.month, t.flowKinds.RECEIPT, t.flowKinds.CUT, t.flowKinds.TAILOR_SEND, t.flowKinds.TAILOR_RETURN, t.flowKinds.TRANSFER]}
          rows={o.flow.map((m) => [
            m.month,
            num(m.RECEIPT.qty),
            num(m.CUT.qty),
            num(m.TAILOR_SEND.qty),
            num(m.TAILOR_RETURN.qty),
            num(m.TRANSFER.qty),
          ])}
        />
      </Section>

      <Section title={t.s.hygiene}>
        {hyg.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.hyg.allGood}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {hyg.map((x, i) => (
              <li key={i} className="rounded-xl border px-4 py-3">
                <p className="leading-relaxed">{x.text}</p>
                {x.why && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{x.why}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={t.s.method}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
          {t.method.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {note && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Pairs({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex items-baseline justify-between gap-3 border-b py-1">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="font-semibold tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-muted-foreground">
            {head.map((x, i) => (
              <th key={i} className={"whitespace-nowrap p-2.5 font-medium " + (i === 0 ? "text-left" : "text-right")}>{x}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((x, j) => (
                <td key={j} className={"p-2.5 " + (j === 0 ? "text-left font-medium" : "whitespace-nowrap text-right tabular-nums")}>{x}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Mark({ bad, children }: { bad?: boolean; children: ReactNode }) {
  return <span className={bad ? "font-semibold text-rose-600" : undefined}>{children}</span>;
}

function Note({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <p className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONE[tone]}`}>{children}</p>;
}
