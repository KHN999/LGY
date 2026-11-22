import Link from "next/link";
import type { ReactNode } from "react";
import type { AnalyticsOverview } from "@/lib/api-client";
import { formatDate, formatKyat } from "@/lib/utils";
import { OneBar, TwoBars } from "./charts";
import { DeletedCases } from "./cases";
import { Fold, HBars, Meter, MiniCols, ORDINAL, SERIES, Segments } from "./viz";
import { BANKS, WEEKDAYS, lakh, pct, t } from "./text.my";

type Tone = "bad" | "warn" | "info" | "good";
const TONE: Record<Tone, string> = {
  bad: "border-rose-300 bg-rose-50 text-rose-950",
  warn: "border-amber-300 bg-amber-50 text-amber-950",
  info: "border-slate-200 bg-card",
  good: "border-emerald-300 bg-emerald-50 text-emerald-950",
};
const ICON: Record<Tone, string> = { bad: "⛔", warn: "⚠️", info: "ℹ️", good: "✅" };
const num = (v: number) => Math.round(v).toLocaleString("en-US");
/** "2026-06" → "06/26": short enough for a phone-width axis. */
const shortMonth = (ym: string) => `${ym.slice(5)}/${ym.slice(2, 4)}`;
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
  if (r.deleted.unpaid > 0) {
    const dup = r.deleted.list.find((d) => d.twin?.matchesUnpaid);
    out.push({
      tone: "bad",
      text: dup
        ? f.deletedDouble(dup.name, lakh(dup.unpaid))
        : f.deleted(lakh(r.deleted.unpaid), r.deleted.unpaidCount, r.deleted.list.map((d) => d.name).join("၊ ")),
    });
  }

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

export function Report({ o }: { o: AnalyticsOverview }) {
  const c = t.col;
  const mixTotal = sum(o.payments.mix, (m) => m.total) || 1;
  const h = o.hygiene;
  // Lead with the handful that matter; the rest are one tap away.
  const all = findings(o);
  const top = all.slice(0, 6);
  const rest = all.slice(6);
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

      <Section title={t.findings} note={t.findingsNote}>
        <ul className="flex flex-col gap-2">
          {top.map((x, i) => (
            <li key={i} className={`flex gap-2.5 rounded-xl border px-3 py-3 leading-relaxed sm:gap-3 sm:px-4 ${TONE[x.tone]}`}>
              <span aria-hidden className="shrink-0">{ICON[x.tone]}</span>
              <span>{x.text}</span>
            </li>
          ))}
        </ul>
        {rest.length > 0 && (
          <Fold label={t.moreFindings(rest.length)}>
            <ul className="flex flex-col gap-2">
              {rest.map((x, i) => (
                <li key={i} className={`flex gap-2.5 rounded-xl border px-3 py-3 leading-relaxed sm:gap-3 sm:px-4 ${TONE[x.tone]}`}>
                  <span aria-hidden className="shrink-0">{ICON[x.tone]}</span>
                  <span>{x.text}</span>
                </li>
              ))}
            </ul>
          </Fold>
        )}
      </Section>


      <Section title={t.s.monthly} note={t.s.monthlyNote}>
        <TwoBars
          data={o.monthly.map((m) => ({ label: shortMonth(m.month), a: m.revenue, b: m.collected }))}
          aName={c.revenue}
          bName={c.collected}
          unitNote="သိန်း"
        />
        <h3 className="mt-2 text-sm font-semibold">{t.v.cashBank}</h3>
        <TwoBars
          stacked
          data={o.monthly.map((m) => ({ label: shortMonth(m.month), a: m.cash, b: m.bank }))}
          aName={c.cash}
          bName={c.bank}
          unitNote="သိန်း"
        />
        <Fold label={t.table}>
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
        </Fold>
      </Section>

      <Section title={t.s.weekly}>
        <OneBar
          data={o.weekly.map((w) => ({ label: formatDate(w.week).slice(0, 5), a: w.revenue }))}
          name={c.revenue}
          unitNote="သိန်း"
        />
        <h3 className="mt-2 text-sm font-semibold">{t.v.weeklyOrders}</h3>
        <HBars
          rows={o.weekly.map((w) => ({ label: formatDate(w.week), value: w.orders, display: num(w.orders) }))}
          color={SERIES[1]}
        />
        <Fold label={t.table}>
          <Table
            head={[c.week, c.orders, c.revenue]}
            rows={o.weekly.map((w) => [formatDate(w.week), num(w.orders), lakh(w.revenue)])}
          />
        </Fold>
      </Section>

      <Section title={t.s.weekday}>
        <HBars
          rows={o.weekdays.map((d) => ({
            label: WEEKDAYS[d.dow],
            value: d.revenue,
            display: lakh(d.revenue),
            note: `${num(d.orders)} ${c.orders}`,
          }))}
        />
      </Section>

      <Section title={t.s.products} note={t.s.productsNote}>
        <h3 className="text-sm font-semibold">{t.v.productRevenue}</h3>
        <HBars
          rows={o.products.slice(0, 8).map((p) => ({
            label: p.label,
            value: p.revenue,
            display: `${lakh(p.revenue)} · ${pct(p.share)}`,
            note: `${num(p.qty)} ${t.v.pieces}`,
          }))}
        />
        <h3 className="mt-3 text-sm font-semibold">{t.v.productMargin}</h3>
        <HBars
          max={0.5}
          color={SERIES[2]}
          rows={o.products
            .filter((p) => p.marginPct != null)
            .slice(0, 8)
            .map((p) => ({
              label: p.label,
              value: Math.max(0, Math.min(p.marginPct ?? 0, 0.5)),
              display: pct(p.marginPct ?? 0),
              note: `${num(p.avgPrice)} − ${num(p.costPrice ?? 0)}`,
              flag: p.belowCost ? t.v.belowCost : undefined,
            }))}
        />
        <h3 className="mt-3 text-sm font-semibold">{t.v.productCover}</h3>
        <p className="text-xs text-muted-foreground">{t.v.coverNote}</p>
        <HBars
          max={365}
          color={SERIES[3]}
          rows={o.products
            .filter((p) => p.qty30 > 0)
            .slice(0, 8)
            .map((p) => ({
              label: p.label,
              value: Math.max(0, Math.min(p.daysCover ?? 0, 365)),
              display: p.onHand <= 0 ? "" : `${num(p.daysCover ?? 0)} ${t.daysUnit}`,
              note: `${c.onHand} ${num(p.onHand)} · ${c.sold30} ${num(p.qty30)}`,
              flag: p.onHand <= 0 ? t.outOfStock : undefined,
            }))}
        />
        <Fold label={t.table}>
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
        </Fold>
      </Section>

      <Section title={t.s.profit} note={t.profit.note}>
        <Pairs
          rows={[
            [t.profit.costedRevenue, `${lakh(o.profit.costedRevenue)} (${pct(o.profit.costedShare)})`],
            [t.profit.gross, lakh(o.profit.grossProfit)],
            [t.profit.margin, o.profit.marginPct != null ? pct(o.profit.marginPct) : t.never],
            [t.profit.expenses, `${formatKyat(o.profit.expenseTotal)} (${num(o.profit.expenses)})`],
            [t.profit.tailor, formatKyat(o.profit.tailorCharged)],
            ...(o.totals.external > 0 ? ([[t.profit.external, formatKyat(o.totals.external)]] as [string, string][]) : []),
          ]}
        />
      </Section>

      <Section title={t.s.customers}>
        <h3 className="text-sm font-semibold">{t.v.whoBuys}</h3>
        <Segments
          parts={[
            { label: t.v.top5, value: o.customers.top5Share * o.totals.revenue, color: SERIES[0] },
            { label: t.v.next15, value: (o.customers.top20Share - o.customers.top5Share) * o.totals.revenue, color: SERIES[1] },
            { label: t.v.otherAccounts, value: o.totals.accountRevenue - o.customers.top20Share * o.totals.revenue, color: SERIES[2] },
            { label: t.v.walkin, value: o.totals.walkinRevenue, color: SERIES[3] },
            { label: t.v.deleted, value: o.receivables.deleted.revenue, color: SERIES[4] },
          ].map((p) => ({ ...p, display: lakh(p.value) }))}
        />
        <h3 className="mt-3 text-sm font-semibold">{t.cust.top10}</h3>
        <HBars
          rows={o.customers.top.map((x) => ({
            label: <Link href={`/admin/customers/${x.id}`} className="underline decoration-dotted">{x.name}</Link>,
            tip: `${x.name}: ${lakh(x.revenue)}`,
            value: x.revenue,
            display: lakh(x.revenue),
            note: `${num(x.orders)} ${c.orders}${x.balance > 0 ? ` · ${c.balance} ${lakh(x.balance)}` : ""}`,
          }))}
        />
        <Fold label={t.table}>
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
        <div className="h-3" />
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
        </Fold>
      </Section>

      <Section title={t.s.receivables} note={t.s.receivablesNote}>
        <h3 className="text-sm font-semibold">{t.v.aging}</h3>
        <HBars
          rows={(["d0_30", "d31_60", "d61_90", "d90plus"] as const).map((k, i) => ({
            label: t.aging[k],
            value: o.receivables.aging[k].amount,
            display: lakh(o.receivables.aging[k].amount),
            note: t.agingPeople(o.receivables.aging[k].count),
            color: ORDINAL[i],
          }))}
        />
        <h3 className="mt-3 text-sm font-semibold">{t.recv.top}</h3>
        <HBars
          rows={o.receivables.top.map((x) => ({
            label: <Link href={`/admin/customers/${x.id}`} className="underline decoration-dotted">{x.name}</Link>,
            tip: `${x.name}: ${formatKyat(x.balance)}`,
            value: x.balance,
            display: lakh(x.balance),
            note: x.daysSincePayment != null ? `${num(x.daysSincePayment)} ${t.daysUnit}` : undefined,
            flag: (x.daysSincePayment ?? 0) > 90 ? t.v.over90 : undefined,
          }))}
        />
        <Fold label={t.table}>
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
        </Fold>
        {o.receivables.inCredit.count > 0 && (
          <div className={`flex flex-col gap-3 rounded-2xl border p-4 ${TONE.warn}`}>
            <div>
              <h3 className="text-base font-bold">{t.credit.title}</h3>
              <p className="mt-1 text-sm leading-relaxed">
                {t.recv.inCredit(o.receivables.inCredit.count, formatKyat(o.receivables.inCredit.amount))} {t.credit.intro}
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {o.receivables.inCredit.list.map((x) => (
                <li key={x.id} className="rounded-xl border bg-white p-3 text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Link href={`/admin/customers/${x.id}`} className="font-bold underline decoration-dotted">{x.name}</Link>
                    <span className="whitespace-nowrap text-base font-bold tabular-nums">
                      {t.credit.over} {formatKyat(x.credit)}
                    </span>
                  </p>
                  <p className="mt-0.5 tabular-nums opacity-90">
                    {t.credit.bought} {formatKyat(x.bought)} ({num(x.orders)}) · {t.credit.paid} {formatKyat(x.paid)}
                    {x.lastPayment ? ` · ${formatDate(x.lastPayment)}` : ""}
                  </p>
                  <p className="mt-1 leading-relaxed">{t.credit.reason[x.reason]}</p>
                  {x.sameName && <p className="mt-1 leading-relaxed">⚠ {t.credit.sameName}</p>}
                </li>
              ))}
            </ul>
            <p className="text-sm font-semibold leading-relaxed">{t.credit.fix}</p>
          </div>
        )}
        <DeletedCases list={o.receivables.deleted.list} />
      </Section>

      <Section title={t.s.payables}>
        <h3 className="text-sm font-semibold">{t.v.supplierSplit}</h3>
        <Segments
          parts={[
            { label: t.pay.paid, value: o.payables.supplierPaid, display: lakh(o.payables.supplierPaid), color: SERIES[0] },
            { label: t.pay.owed, value: Math.max(0, o.payables.supplierOwed), display: lakh(o.payables.supplierOwed), color: SERIES[1] },
          ]}
        />
        <Fold label={t.table}>
        <Pairs
          rows={[
            [t.pay.ordered, lakh(o.payables.supplierOrdered)],
            [t.pay.paid, lakh(o.payables.supplierPaid)],
            [t.pay.owed, formatKyat(o.payables.supplierOwed)],
          ]}
        />
        </Fold>
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
        <Segments
          parts={o.payments.mix.slice(0, 5).map((m, i) => ({
            label:
              m.method === "BANK_TRANSFER"
                ? `${t.methods[m.method]} · ${m.bank ? (BANKS[m.bank] ?? m.bank) : t.bankNotRecorded}`
                : (t.methods[m.method] ?? m.method),
            value: m.total,
            display: lakh(m.total),
            color: SERIES[i],
          }))}
        />
        <Fold label={t.table}>
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
        </Fold>
      </Section>

      <Section title={t.s.stock}>
        <h3 className="text-sm font-semibold">
          {t.v.stockWhere} — {lakh(o.stock.totals.totalValue)}
        </h3>
        <Segments
          parts={[
            { label: c.warehouse, value: o.stock.totals.warehouseValue, color: SERIES[0] },
            { label: c.shop, value: o.stock.totals.shopValue, color: SERIES[1] },
            { label: c.atTailors, value: o.stock.totals.tailorValue, color: SERIES[2] },
          ].map((p) => ({ ...p, display: lakh(p.value) }))}
        />
        {o.stock.idle.length > 0 && (
          <>
            <h3 className="mt-2 text-sm font-semibold">{t.stock.idle}</h3>
            <p className="text-xs text-muted-foreground">{t.stock.idleNote}</p>
            <HBars
              color={SERIES[3]}
              rows={o.stock.idle.map((x) => ({ label: x.label, value: x.value, display: lakh(x.value), note: `${num(x.qty)} ${t.v.pieces}` }))}
            />
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
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {(["RECEIPT", "CUT", "TAILOR_SEND", "TAILOR_RETURN", "TRANSFER"] as const).map((k) => (
            <MiniCols
              key={k}
              title={t.flowKinds[k]}
              total={num(sum(o.flow, (m) => m[k].qty))}
              data={o.flow.map((m) => ({ label: m.month.slice(5), value: m[k].qty, display: num(m[k].qty) }))}
            />
          ))}
        </div>
        <Fold label={t.table}>
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
        </Fold>
      </Section>

      <Section title={t.s.hygiene}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Meter
            label={t.v.closesMeter}
            value={h.closedSaleDays}
            max={h.saleDays}
            display={`${num(h.closedSaleDays)} / ${num(h.saleDays)}`}
            bad={h.saleDays > 0 && h.closedSaleDays / h.saleDays < 0.5}
          />
          <Meter
            label={t.v.voidMeter}
            value={h.voidedSales}
            max={h.sales}
            display={h.sales > 0 ? pct(h.voidedSales / h.sales) : t.never}
            bad={h.sales > 0 && h.voidedSales / h.sales >= 0.08}
          />
          <Meter label={t.v.costedMeter} value={o.profit.costedShare} max={1} display={pct(o.profit.costedShare)} />
        </div>
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
    <section className="flex min-w-0 flex-col gap-3">
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
    <div className="min-w-0 rounded-2xl border bg-card p-3 sm:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-bold tabular-nums sm:text-lg">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Pairs({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-8 gap-y-1.5 text-sm sm:grid-cols-2">
      {rows.map(([k, v]) => (
        <div key={k} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b py-1">
          <dt className="min-w-0 text-muted-foreground">{k}</dt>
          <dd className="ml-auto whitespace-nowrap font-semibold tabular-nums">{v}</dd>
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
