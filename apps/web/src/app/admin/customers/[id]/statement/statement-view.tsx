"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CustomerStatement, ShopSettings } from "@/lib/api-client";
import { bankLabel } from "@/lib/banks";
import { labels } from "@/lib/labels";
import { formatDate } from "@/lib/utils";

const L = labels.customerStatement;
const num = (n: number) => n.toLocaleString("en-US");
/** YYYY-MM-DD → display date, read as a Yangon day. */
const day = (ymd: string) => formatDate(`${ymd}T12:00:00+06:30`);

function shiftMonth(ymd: string, months: number): string {
  const d = new Date(`${ymd.slice(0, 8)}01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}
function shiftDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function describe(r: CustomerStatement["rows"][number]): string {
  if (r.kind === "SALE") return `${L.sale} #${r.refId}`;
  if (r.kind === "RETURN") {
    return `${L.return}${r.saleId ? ` #${r.saleId}` : ""}${r.debit > 0 ? ` · ${L.refund} ${num(r.debit)}` : ""}`;
  }
  const how =
    r.method === "BANK_TRANSFER"
      ? `${labels.paymentReceipt.methodBank}${r.bank ? ` · ${bankLabel(r.bank)}` : ""}`
      : r.method === "CASH"
        ? labels.paymentReceipt.methodCash
        : (r.method ?? "");
  return `${L.payment} · ${r.saleId ? L.payForSale(r.saleId) : L.debtPayment}${how ? ` · ${how}` : ""}`;
}

/** The statement itself — the same markup on screen and in the print slot. */
function Doc({ s, shop, today, showItems }: { s: CustomerStatement; shop?: ShopSettings; today: string; showItems: boolean }) {
  const periodFrom = s.from ? day(s.from) : s.firstDate ? formatDate(s.firstDate) : L.fromStart;
  const periodTo = day(s.to ?? today);
  const closingLabel = s.closing < 0 ? L.credit : L.closing;
  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <header className="text-center">
        <h1 className="text-xl font-extrabold">{shop?.shopName?.trim() || labels.receipt.shopName}</h1>
        {shop?.addressLine?.trim() && <p className="whitespace-pre-line text-xs">{shop.addressLine.trim()}</p>}
        {shop?.phone?.trim() && <p className="text-xs">{shop.phone.trim()}</p>}
        <h2 className="mt-3 border-y-2 border-black py-1 text-base font-bold">{L.title}</h2>
      </header>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-1 text-sm">
        <div>
          <p className="text-base font-bold">{s.customer.name}</p>
          {s.customer.contact && <p className="text-xs">{s.customer.contact}</p>}
        </div>
        <div className="text-right text-xs">
          <p>
            {L.period}: <span className="font-semibold">{periodFrom} – {periodTo}</span>
          </p>
          <p>
            {L.printedOn}: {day(today)}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 border-y py-2 text-sm sm:grid-cols-5">
        {(
          [
            [L.opening, s.opening, false],
            [`${L.bought} (${s.totals.salesCount})`, s.totals.sales, false],
            [`${L.paid} (${s.totals.paymentsCount})`, s.totals.payments, false],
            [L.returned, s.totals.returned - s.totals.refunded, false],
            [closingLabel, Math.abs(s.closing), true],
          ] as const
        ).map(([k, v, strong]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-[10px] text-neutral-600">{k}</dt>
            <dd className={"tabular-nums " + (strong ? "text-base font-extrabold" : "font-semibold")}>{num(v)}</dd>
          </div>
        ))}
      </dl>

      <table className="mt-3 w-full border-collapse text-xs">
        <thead>
          <tr className="border-b-2 border-black text-left">
            <th className="py-1 pr-2 font-semibold">{L.date}</th>
            <th className="py-1 pr-2 font-semibold">{L.detail}</th>
            <th className="py-1 pr-2 text-right font-semibold">{L.bought}</th>
            <th className="py-1 pr-2 text-right font-semibold">{L.paid}</th>
            <th className="py-1 text-right font-semibold">{L.balance}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b text-neutral-700">
            <td className="py-1 pr-2" colSpan={4}>{L.opening}</td>
            <td className="py-1 text-right tabular-nums">{num(s.opening)}</td>
          </tr>
          {s.rows.map((r) => (
            <tr key={`${r.kind}-${r.refId}`} className="border-b align-top">
              <td className="whitespace-nowrap py-1 pr-2 tabular-nums">{formatDate(r.date)}</td>
              <td className="py-1 pr-2">
                {describe(r)}
                {showItems && r.items.length > 0 && (
                  <span className="block text-[10px] leading-snug text-neutral-600">
                    {r.items.map((i) => `${i.label} ${num(i.qty)} × ${num(i.unitPrice)}`).join(" · ")}
                  </span>
                )}
              </td>
              <td className="py-1 pr-2 text-right tabular-nums">{r.kind === "SALE" ? num(r.debit) : ""}</td>
              <td className="py-1 pr-2 text-right tabular-nums">
                {r.kind === "PAYMENT" ? num(r.credit) : r.kind === "RETURN" ? num(r.credit - r.debit) : ""}
              </td>
              <td className="py-1 text-right tabular-nums">{num(r.balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-black font-bold">
            <td className="py-1 pr-2" colSpan={2}>{L.total} · {closingLabel}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{num(s.totals.sales)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">
              {num(s.totals.payments + s.totals.returned - s.totals.refunded)}
            </td>
            <td className="py-1 text-right tabular-nums">{num(s.closing)}</td>
          </tr>
        </tbody>
      </table>

      {s.rows.length === 0 && <p className="mt-3 text-center text-xs text-neutral-500">{L.empty}</p>}
      {shop?.receiptFooter?.trim() && (
        <p className="mt-6 whitespace-pre-line text-center text-xs text-neutral-600">{shop.receiptFooter.trim()}</p>
      )}
    </div>
  );
}

export function StatementView({
  s,
  shop,
  today,
  from,
  to,
}: {
  s: CustomerStatement;
  shop?: ShopSettings;
  today: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [showItems, setShowItems] = useState(true);
  useEffect(() => setMounted(true), []);

  const base = `/admin/customers/${s.customer.id}/statement`;
  const go = (f?: string, t?: string) => {
    if (!f && !t) return router.push(`${base}?all=1`);
    const q = new URLSearchParams();
    if (f) q.set("from", f);
    if (t) q.set("to", t > today ? today : t);
    router.push(`${base}?${q}`);
  };
  const monthStart = `${today.slice(0, 8)}01`;
  const lastStart = shiftMonth(today, -1);
  const presets: { label: string; f?: string; t?: string; on: boolean }[] = [
    { label: L.thisMonth, f: monthStart, t: today, on: from === monthStart && to === today },
    { label: L.lastMonth, f: lastStart, t: shiftDays(monthStart, -1), on: from === lastStart && to === shiftDays(monthStart, -1) },
    { label: L.last30, f: shiftDays(today, -29), t: today, on: from === shiftDays(today, -29) && to === today },
    { label: L.allTime, on: !from && !to },
  ];
  const input = "rounded-lg border bg-background px-3 py-2 text-sm tabular-nums";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/admin/customers/${s.customer.id}`} className="rounded-lg border px-3 py-2 text-sm hover:bg-accent">
            ← {L.back}
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            🖨 {labels.common.print}
          </button>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {L.from}
            <input
              id="stmt-from"
              type="date"
              className={input}
              value={from ?? ""}
              max={to ?? today}
              onChange={(e) => e.target.value && go(e.target.value, to ?? today)}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {L.to}
            <input
              id="stmt-to"
              type="date"
              className={input}
              value={to ?? ""}
              min={from}
              max={today}
              onChange={(e) => e.target.value && go(from, e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => go(p.f, p.t)}
                className={"rounded-lg px-3 py-2 text-sm " + (p.on ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input id="stmt-items" type="checkbox" checked={showItems} onChange={(e) => setShowItems(e.target.checked)} />
          {L.showItems}
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm print:hidden">
        <Doc s={s} shop={shop} today={today} showItems={showItems} />
      </div>

      {mounted &&
        createPortal(
          <div id="print-document" className="hidden print:block">
            <Doc s={s} shop={shop} today={today} showItems={showItems} />
          </div>,
          document.body,
        )}
    </div>
  );
}
