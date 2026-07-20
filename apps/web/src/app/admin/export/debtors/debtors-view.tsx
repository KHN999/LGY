"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { DebtorsReport, ShopSettings } from "@/lib/api-client";
import { formatKyat } from "@/lib/utils";

const num = (n: number) => n.toLocaleString("en-US");

/** Printable debtors report — who owes what right now (live snapshot). */
function DebtorsDoc({ r, shop }: { r: DebtorsReport; shop?: ShopSettings | null }) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <header className="text-center">
        <h1 className="text-xl font-bold">{shop?.shopName ?? "LGY"}</h1>
        {shop?.addressLine && <p className="text-xs">{shop.addressLine}</p>}
        {shop?.phone && <p className="text-xs">{shop.phone}</p>}
        <h2 className="mt-2 text-base font-semibold uppercase tracking-wide">Debtors statement</h2>
        <p className="text-xs">As of today</p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <Sum label="Debtors" value={String(r.count)} />
        <Sum label="Total owed" value={formatKyat(r.total)} strong />
      </dl>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y text-left">
            <th className="py-1 pr-2 font-semibold">Customer</th>
            <th className="py-1 pr-2 font-semibold">Contact</th>
            <th className="py-1 text-right font-semibold">Owes</th>
          </tr>
        </thead>
        <tbody>
          {r.rows.map((d) => (
            <tr key={d.id} className="border-b align-top">
              <td className="py-1 pr-2">{d.name}</td>
              <td className="py-1 pr-2">{d.contact ?? ""}</td>
              <td className="py-1 text-right tabular-nums">{num(d.balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="py-1 pr-2" colSpan={2}>
              Total
            </td>
            <td className="py-1 text-right tabular-nums">{num(r.total)}</td>
          </tr>
        </tbody>
      </table>

      {r.rows.length === 0 && (
        <p className="mt-3 text-center text-xs text-neutral-500">No outstanding debt.</p>
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

export function DebtorsReportView({
  report,
  shop,
}: {
  report: DebtorsReport;
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
        <DebtorsDoc r={report} shop={shop} />
      </div>

      {mounted &&
        createPortal(
          <div id="print-document" className="hidden print:block">
            <DebtorsDoc r={report} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}
