"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { SalesReport, ShopSettings } from "@/lib/api-client";
import { formatKyat } from "@/lib/utils";

const num = (n: number) => n.toLocaleString("en-US");

/** Printable sales report — every sale in the period, with totals. */
function SalesDoc({ r, shop }: { r: SalesReport; shop?: ShopSettings | null }) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <header className="text-center">
        <h1 className="text-xl font-bold">{shop?.shopName ?? "LGY"}</h1>
        {shop?.addressLine && <p className="text-xs">{shop.addressLine}</p>}
        {shop?.phone && <p className="text-xs">{shop.phone}</p>}
        <h2 className="mt-2 text-base font-semibold uppercase tracking-wide">Sales statement</h2>
        <p className="text-xs">
          {r.from} → {r.to}
        </p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Sum label="Sales" value={String(r.count)} />
        <Sum label="Gross" value={formatKyat(r.totalGrand)} />
        <Sum label="Paid" value={formatKyat(r.totalPaid)} />
        <Sum label="Unpaid" value={formatKyat(r.totalRemaining)} strong />
      </dl>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y text-left">
            <th className="py-1 pr-2 font-semibold">#</th>
            <th className="py-1 pr-2 font-semibold">Date</th>
            <th className="py-1 pr-2 font-semibold">Customer</th>
            <th className="py-1 pr-2 text-right font-semibold">Grand</th>
            <th className="py-1 pr-2 text-right font-semibold">Paid</th>
            <th className="py-1 text-right font-semibold">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((s) => (
            <tr key={s.id} className="border-b align-top">
              <td className="py-1 pr-2">{s.id}</td>
              <td className="whitespace-nowrap py-1 pr-2">{s.date.slice(0, 10)}</td>
              <td className="py-1 pr-2">{s.customer}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{num(s.grandTotal)}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{num(s.paid)}</td>
              <td className="py-1 text-right tabular-nums">{s.remaining ? num(s.remaining) : ""}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="py-1 pr-2" colSpan={3}>
              Totals
            </td>
            <td className="py-1 pr-2 text-right tabular-nums">{num(r.totalGrand)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{num(r.totalPaid)}</td>
            <td className="py-1 text-right tabular-nums">{num(r.totalRemaining)}</td>
          </tr>
        </tbody>
      </table>

      {r.rows.length === 0 && (
        <p className="mt-3 text-center text-xs text-neutral-500">No sales in this period.</p>
      )}
    </div>
  );
}

function Sum({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[10px] uppercase tracking-wide text-neutral-500">{label}</dt>
      <dd className={"tabular-nums " + (strong ? "font-bold" : "font-medium")}>{value}</dd>
    </div>
  );
}

export function SalesReportView({
  report,
  shop,
}: {
  report: SalesReport;
  shop?: ShopSettings | null;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/admin/export" className="rounded-lg border px-4 py-2 text-sm hover:bg-accent">
          ← Export
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          🖨 Print / Save as PDF
        </button>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border bg-white shadow-sm print:hidden">
        <SalesDoc r={report} shop={shop} />
      </div>

      {mounted &&
        createPortal(
          <div id="print-receipt" className="hidden print:block">
            <SalesDoc r={report} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}
