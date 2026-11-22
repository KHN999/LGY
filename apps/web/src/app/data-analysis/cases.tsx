import Link from "next/link";
import type { AnalyticsOverview } from "@/lib/api-client";
import { formatDate, formatKyat } from "@/lib/utils";
import { lakh, t } from "./text.my";

type Case = AnalyticsOverview["receivables"]["deleted"]["list"][number];

/** Three figures for one customer record: invoiced, paid, left. */
function RecordBox({ title, id, invoiced, paid, left, bad }: { title: string; id: number; invoiced: number; paid: number; left: number; bad?: boolean }) {
  return (
    <div className={"rounded-xl border-2 bg-white p-3 " + (bad ? "border-rose-300" : "border-emerald-300")}>
      <p className="flex flex-wrap items-baseline justify-between gap-x-2 text-sm font-bold">
        <span>{title}</span>
        <Link href={`/admin/customers/${id}`} className="text-xs font-normal underline">{t.del.open}</Link>
      </p>
      <dl className="mt-2 flex flex-col gap-1 text-sm tabular-nums">
        <div className="flex justify-between gap-3"><dt>{t.del.invoiced}</dt><dd className="font-semibold">{lakh(invoiced)}</dd></div>
        <div className="flex justify-between gap-3"><dt>{t.del.paid}</dt><dd className="font-semibold">{lakh(paid)}</dd></div>
        <div className="flex justify-between gap-3 border-t pt-1">
          <dt>{t.del.left}</dt>
          <dd className={"font-bold " + (left > 0 ? "text-rose-700" : "text-emerald-700")}>{lakh(Math.max(left, 0))}</dd>
        </div>
      </dl>
    </div>
  );
}

/** One deleted customer who still owes money, told as a story: the two records
 *  side by side, what happened in order, what it could mean, and the one
 *  question that settles it. */
function CaseCard({ c }: { c: Case }) {
  const d = t.del;
  const tw = c.twin;
  type Ev = { at: string; text: string; sub?: string; warn?: boolean };
  const events: Ev[] = [{ at: c.createdAt, text: d.evCreated(d.rec1) }];
  if (c.deletedAt) events.push({ at: c.deletedAt, text: d.evDeleted(d.rec1), warn: true });
  for (const inv of c.invoices) {
    const late = c.deletedAt != null && inv.enteredAt > c.deletedAt;
    const dated = formatDate(inv.saleDate) !== formatDate(inv.enteredAt) ? d.evDated(formatDate(inv.saleDate)) : undefined;
    events.push({
      at: inv.enteredAt,
      text: d.evInvoice(d.rec1, inv.id, lakh(inv.total)),
      sub: [dated, late ? d.evAfterDelete : undefined].filter(Boolean).join(" · ") || undefined,
      warn: late,
    });
  }
  if (tw) {
    events.push({ at: tw.createdAt, text: d.evCreated(d.rec2) });
    for (const inv of tw.invoices) {
      events.push({ at: inv.enteredAt, text: d.evInvoice(d.rec2, inv.id, lakh(inv.total)) });
    }
  }
  events.sort((a, b) => a.at.localeCompare(b.at));

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-rose-950">
      <div>
        <h4 className="text-base font-bold leading-snug">{d.caseTitle(c.name, lakh(c.unpaid))}</h4>
        <p className="mt-1 text-sm leading-relaxed">{tw ? d.introTwo(lakh(c.unpaid)) : d.introOne(lakh(c.unpaid))}</p>
      </div>

      <div className={"grid gap-3 " + (tw ? "sm:grid-cols-2" : "")}>
        <RecordBox title={d.recOld} id={c.id} invoiced={c.revenue} paid={c.paid} left={c.unpaid} bad />
        {tw && <RecordBox title={d.recNew} id={tw.id} invoiced={tw.revenue} paid={tw.paid} left={tw.balance} />}
      </div>

      <div>
        <p className="text-sm font-bold">{d.timeline}</p>
        <ol className="mt-2 flex flex-col">
          {events.map((e, i) => (
            <li key={i} className="grid grid-cols-[5.5rem_auto_1fr] gap-x-2 text-sm">
              <span className="pt-0.5 tabular-nums opacity-80">{formatDate(e.at)}</span>
              <span aria-hidden className="flex flex-col items-center">
                <span className={"mt-1.5 h-2.5 w-2.5 rounded-full " + (e.warn ? "bg-rose-600" : "bg-slate-400")} />
                {i < events.length - 1 && <span className="w-px flex-1 bg-slate-300" />}
              </span>
              <span className="pb-3 leading-relaxed">
                <span className={e.warn ? "font-semibold" : undefined}>{e.text}</span>
                {e.sub && <span className="block text-xs opacity-90">⚠ {e.sub}</span>}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold">{d.means}</p>
        {tw ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-3 text-sm leading-relaxed">
              <p className="font-bold">
                {d.optA}
                {tw.matchesUnpaid && (
                  <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">{d.optALikely}</span>
                )}
              </p>
              {tw.matchesUnpaid && <p className="mt-1">{d.optAWhy(formatKyat(tw.revenue))}</p>}
              <p className="mt-1">{d.optAThen(lakh(c.revenue), lakh(tw.revenue))}</p>
            </div>
            <div className="rounded-xl border bg-white p-3 text-sm leading-relaxed">
              <p className="font-bold">{d.optB}</p>
              <p className="mt-1">{d.optBThen(lakh(c.revenue + tw.revenue), lakh(c.unpaid))}</p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border bg-white p-3 text-sm leading-relaxed">{d.optBOnly(lakh(c.unpaid))}</p>
        )}
      </div>

      {tw && (
        <div className="rounded-xl border-2 border-rose-400 bg-white p-3 text-sm leading-relaxed">
          <p className="font-bold">{d.ask}</p>
          <p className="mt-1 text-base font-semibold">{d.askQ(c.name, lakh(c.revenue), lakh(c.revenue + tw.revenue))}</p>
          <p className="mt-1 opacity-90">{d.askPaid(lakh(c.paid + tw.paid))}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>{d.fixA}</li>
            <li>{d.fixB}</li>
          </ul>
        </div>
      )}
    </article>
  );
}

export function DeletedCases({ list }: { list: Case[] }) {
  if (list.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <h3 className="mt-2 text-sm font-semibold">{t.del.title}</h3>
      {list.map((c) => (
        <CaseCard key={c.id} c={c} />
      ))}
    </div>
  );
}
