"use client";

import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import type { ShopSettings } from "@/lib/api-client";

export interface ReceiptLine {
  label: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  note?: string | null;
}

export interface ReceiptData {
  saleId: number | null;
  date: string | Date;
  customerName?: string | null; // omitted from the receipt when empty (walk-in)
  lines: ReceiptLine[];
  grandTotal: number;
  paid: number;
}

/** Hide the element if its image source 404s (e.g. no logo.png uploaded yet). */
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

/**
 * Receipt — sized for A5 paper (see the print rules in globals.css). Used both
 * as the on-screen preview and the printed copy. The header/footer text comes
 * from editable shop settings (admin app); blank fields fall back to defaults.
 *
 * Logo + watermark come from the bundled /logo.svg (drop your logo there). Both
 * are real <img> elements with print-color-adjust so they survive printing —
 * browsers drop CSS background graphics — and self-hide if the file is missing.
 */
export function Receipt({ data, shop }: { data: ReceiptData; shop?: ShopSettings }) {
  const remaining = data.grandTotal - data.paid;
  const d = new Date(data.date);
  const shopName = shop?.shopName?.trim() || labels.receipt.shopName;
  const subtitle = shop?.receiptHeader?.trim() || labels.receipt.title;
  const footer = shop?.receiptFooter?.trim() || labels.receipt.thanks;
  return (
    <div className="relative mx-auto w-full max-w-[150mm] overflow-hidden bg-white p-6 text-black">
      {/* Faint, centered logo watermark behind the content. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo.svg"
        alt=""
        aria-hidden="true"
        onError={hideOnError}
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-3/4 -translate-x-1/2 -translate-y-1/2 select-none"
        style={{ opacity: 0.08, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
      />

      <div className="relative z-10">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt={shopName}
            onError={hideOnError}
            className="mx-auto mb-2 h-16 w-auto object-contain"
          />
          <h2 className="text-2xl font-extrabold tracking-wide">{shopName}</h2>
          <p className="text-sm font-medium text-neutral-700">{subtitle}</p>
          {shop?.addressLine?.trim() && (
            <p className="mt-1 text-xs text-neutral-600">{shop.addressLine}</p>
          )}
          {shop?.phone?.trim() && <p className="text-xs text-neutral-600">{shop.phone}</p>}
          {shop?.social?.trim() && <p className="text-xs text-neutral-600">{shop.social}</p>}
        </div>

        <div className="mt-4 flex justify-between text-sm">
          <span>
            {labels.receipt.no}: {data.saleId ?? "—"}
          </span>
          <span>{formatDateTime(d)}</span>
        </div>
        {data.customerName?.trim() && (
          <div className="text-sm">
            {labels.receipt.customer}: <span className="font-medium">{data.customerName}</span>
          </div>
        )}

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-1 text-left font-semibold">{labels.receipt.item}</th>
              <th className="py-1 text-right font-semibold">{labels.receipt.qty}</th>
              <th className="py-1 text-right font-semibold">{labels.receipt.price}</th>
              <th className="py-1 text-right font-semibold">{labels.receipt.amount}</th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i} className="border-b border-neutral-300 align-top">
                <td className="py-1 pr-2">
                  {l.label}
                  {l.note ? (
                    <span className="block text-xs italic text-neutral-500">{l.note}</span>
                  ) : null}
                </td>
                <td className="py-1 text-right tabular-nums">{l.qty}</td>
                <td className="py-1 text-right tabular-nums">{l.unitPrice.toLocaleString("en-US")}</td>
                <td className="py-1 text-right tabular-nums">{l.lineTotal.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto w-2/3 space-y-1 text-sm sm:w-1/2">
          <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
            <span>{labels.receipt.total}</span>
            <span>{formatKyat(data.grandTotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>{labels.receipt.paid}</span>
            <span>{formatKyat(data.paid)}</span>
          </div>
          {remaining > 0 && (
            <div className="flex justify-between font-medium">
              <span>{labels.receipt.remaining}</span>
              <span>{formatKyat(remaining)}</span>
            </div>
          )}
        </div>

        <p className="mt-8 whitespace-pre-line text-center text-sm">{footer}</p>
      </div>
    </div>
  );
}
