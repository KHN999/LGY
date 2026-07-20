"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import type { Statement, ShopSettings } from "@/lib/api-client";
import { formatKyat } from "@/lib/utils";

const num = (n: number) => n.toLocaleString("en-US");

/** The printable statement document — used both on screen and in the print
 *  portal. Plain black-on-white so it reads as a proper statement on paper. */
function StatementDoc({ s, shop }: { s: Statement; shop?: ShopSettings | null }) {
  return (
    <div className="mx-auto max-w-3xl bg-white p-6 text-black">
      <header className="text-center">
        <h1 className="text-xl font-bold">{shop?.shopName ?? "LGY"}</h1>
        {shop?.addressLine && <p className="text-xs">{shop.addressLine}</p>}
        {shop?.phone && <p className="text-xs">{shop.phone}</p>}
        <h2 className="mt-2 text-base font-semibold uppercase tracking-wide">Statement</h2>
        <p className="text-xs">
          {s.from} → {s.to}
        </p>
      </header>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <Sum label="Opening balance" value={formatKyat(s.openingCash)} />
        <Sum label="Money in" value={formatKyat(s.totalIn)} />
        <Sum label="Money out" value={formatKyat(s.totalOut)} />
        <Sum label="Closing balance" value={formatKyat(s.closingCash)} strong />
      </dl>
      <p className="mt-1 text-xs text-neutral-600">
        Sales in period: {s.salesCount} · {formatKyat(s.salesTotal)}
      </p>

      <table className="mt-4 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y text-left">
            <th className="py-1 pr-2 font-semibold">Date</th>
            <th className="py-1 pr-2 font-semibold">Type</th>
            <th className="py-1 pr-2 font-semibold">Description</th>
            <th className="py-1 pr-2 text-right font-semibold">In</th>
            <th className="py-1 pr-2 text-right font-semibold">Out</th>
            <th className="py-1 text-right font-semibold">Balance</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b text-neutral-600">
            <td className="py-1 pr-2" colSpan={5}>
              Opening balance
            </td>
            <td className="py-1 text-right tabular-nums">{num(s.openingCash)}</td>
          </tr>
          {s.transactions.map((t, i) => (
            <tr key={i} className="border-b align-top">
              <td className="whitespace-nowrap py-1 pr-2">{t.date.slice(0, 10)}</td>
              <td className="whitespace-nowrap py-1 pr-2">{t.type}</td>
              <td className="py-1 pr-2">{t.description}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{t.in ? num(t.in) : ""}</td>
              <td className="py-1 pr-2 text-right tabular-nums">{t.out ? num(t.out) : ""}</td>
              <td className="py-1 text-right tabular-nums">{num(t.balance)}</td>
            </tr>
          ))}
          <tr className="border-t-2 font-semibold">
            <td className="py-1 pr-2" colSpan={3}>
              Totals / Closing
            </td>
            <td className="py-1 pr-2 text-right tabular-nums">{num(s.totalIn)}</td>
            <td className="py-1 pr-2 text-right tabular-nums">{num(s.totalOut)}</td>
            <td className="py-1 text-right tabular-nums">{num(s.closingCash)}</td>
          </tr>
        </tbody>
      </table>

      {s.transactions.length === 0 && (
        <p className="mt-3 text-center text-xs text-neutral-500">No cash movements in this period.</p>
      )}

      {shop?.receiptFooter && (
        <p className="mt-6 text-center text-xs text-neutral-600">{shop.receiptFooter}</p>
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

export function StatementView({
  statement,
  shop,
}: {
  statement: Statement;
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
        <StatementDoc s={statement} shop={shop} />
      </div>

      {mounted &&
        createPortal(
          <div id="print-document" className="hidden print:block">
            <StatementDoc s={statement} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}
