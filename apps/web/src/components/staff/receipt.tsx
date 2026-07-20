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
  customerContact?: string | null; // phone, shown under the name when present
  lines: ReceiptLine[];
  grandTotal: number;
  paid: number;
  method?: "CASH" | "BANK_TRANSFER"; // how the paid portion was tendered
  notes?: string | null; // optional per-sale note (e.g. "collect tomorrow")
  // ── Returns against this sale (omit/empty when none) ──────────────
  returnedLines?: ReceiptLine[]; // goods returned (positive qty; shown as −)
  returnedTotal?: number; // Σ value of goods returned (reduces the total)
  refundedTotal?: number; // Σ cash handed back to the buyer
}

/** Hide the element if its image source 404s (e.g. no logo.png uploaded yet). */
function hideOnError(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

/** Split a multi-value field (phones, socials) into trimmed entries. Accepts
 *  one-per-line (new) or comma-separated (legacy) data. */
function splitEntries(s?: string | null): string[] {
  return (s ?? "")
    .split(/[\n,]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** Faint centered logo watermark behind the content (survives printing). */
export function ReceiptWatermark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.svg"
      alt=""
      aria-hidden="true"
      onError={hideOnError}
      className="pointer-events-none absolute left-1/2 top-1/2 z-0 w-3/4 -translate-x-1/2 -translate-y-1/2 select-none"
      style={{ opacity: 0.08, printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    />
  );
}

/** Shared centered header — logo, shop name, subtitle, address, phones, socials.
 *  Reused by every printable document (sale receipt, payment receipt, …) so the
 *  contact block stays identical across them. */
export function ReceiptHeader({ shop }: { shop?: ShopSettings }) {
  const shopName = shop?.shopName?.trim() || labels.receipt.shopName;
  const subtitle = shop?.receiptHeader?.trim() || labels.receipt.title;
  const phones = splitEntries(shop?.phone);
  const socials = splitEntries(shop?.social);
  return (
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
        <p className="mt-1 whitespace-pre-line text-xs leading-snug text-neutral-600">
          {shop.addressLine.trim()}
        </p>
      )}
      {phones.length > 0 && (
        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-xs leading-snug text-neutral-600">
          {phones.map((p, i) => (
            <span key={i} className="whitespace-nowrap">
              📞 {p}
            </span>
          ))}
        </div>
      )}
      {socials.length > 0 && (
        <p className="text-xs leading-snug text-neutral-600">{socials.join("  ·  ")}</p>
      )}
    </div>
  );
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
  const returnedLines = data.returnedLines ?? [];
  const returnedTotal = data.returnedTotal ?? 0;
  const refundedTotal = data.refundedTotal ?? 0;
  const hasReturns = returnedLines.length > 0 || returnedTotal > 0 || refundedTotal > 0;
  // Returns reduce the receivable (returnedTotal) and cash refunds reduce what was
  // net received (refundedTotal). Net owed = (total − returned) − (paid − refunded).
  const netTotal = data.grandTotal - returnedTotal;
  const balance = netTotal - (data.paid - refundedTotal);
  const remaining = balance > 0 ? balance : 0;
  const credit = balance < 0 ? -balance : 0;
  const d = new Date(data.date);
  const footer = shop?.receiptFooter?.trim() || labels.receipt.thanks;
  return (
    <div className="relative mx-auto w-full max-w-[150mm] overflow-hidden bg-white p-6 text-black">
      <ReceiptWatermark />

      <div className="relative z-10">
        <ReceiptHeader shop={shop} />

        <div className="mt-4 flex justify-between text-sm">
          <span>
            {labels.receipt.no}: {data.saleId ?? "—"}
          </span>
          <span>{formatDateTime(d)}</span>
        </div>
        {data.customerName?.trim() && (
          <div className="text-sm">
            {labels.receipt.customer}: <span className="font-medium">{data.customerName}</span>
            {data.customerContact?.trim() && (
              <span className="text-muted-foreground"> · {data.customerContact}</span>
            )}
          </div>
        )}

        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="py-1 pr-2 text-left font-semibold">{labels.receipt.item}</th>
              <th className="px-2 py-1 text-right font-semibold">{labels.receipt.qty}</th>
              <th className="border-l border-neutral-400 px-2 py-1 text-right font-semibold">
                {labels.receipt.price}
              </th>
              <th className="border-l border-neutral-400 px-2 py-1 text-right font-semibold">
                {labels.receipt.amount}
              </th>
            </tr>
          </thead>
          <tbody>
            {data.lines.map((l, i) => (
              <tr key={i} className="align-top">
                <td className="py-1 pr-2">
                  {l.label}
                  {l.note ? (
                    <span className="block text-xs italic text-neutral-500">{l.note}</span>
                  ) : null}
                </td>
                <td className="px-2 py-1 text-right tabular-nums">{l.qty}</td>
                <td className="border-l border-neutral-400 px-2 py-1 text-right tabular-nums">
                  {l.unitPrice.toLocaleString("en-US")}
                </td>
                <td className="border-l border-neutral-400 px-2 py-1 text-right tabular-nums">
                  {l.lineTotal.toLocaleString("en-US")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Returned goods — shown as negative lines so the paper voucher reflects
            what actually came back, not just the original sale. */}
        {returnedLines.length > 0 && (
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-neutral-400">
                <th className="py-1 pr-2 text-left font-semibold" colSpan={4}>
                  {labels.receipt.returnsHeading}
                </th>
              </tr>
            </thead>
            <tbody>
              {returnedLines.map((l, i) => (
                <tr key={i} className="align-top text-neutral-600">
                  <td className="py-1 pr-2">{l.label}</td>
                  <td className="px-2 py-1 text-right tabular-nums">−{l.qty}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    {l.unitPrice.toLocaleString("en-US")}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    −{l.lineTotal.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="mt-4 ml-auto w-2/3 space-y-1 text-sm sm:w-1/2">
          <div
            className={
              "flex justify-between " +
              (hasReturns
                ? "border-t border-neutral-400 pt-1"
                : "border-t-2 border-black pt-1 text-base font-bold")
            }
          >
            <span>{labels.receipt.total}</span>
            <span>{formatKyat(data.grandTotal)}</span>
          </div>
          {returnedTotal > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>{labels.receipt.returned}</span>
              <span>−{formatKyat(returnedTotal)}</span>
            </div>
          )}
          {hasReturns && (
            <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
              <span>{labels.receipt.netTotal}</span>
              <span>{formatKyat(netTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>
              {labels.receipt.paid}
              {data.paid > 0 && data.method === "BANK_TRANSFER"
                ? ` (${labels.paymentReceipt.methodBank})`
                : data.paid > 0
                  ? ` (${labels.paymentReceipt.methodCash})`
                  : ""}
            </span>
            <span>{formatKyat(data.paid)}</span>
          </div>
          {refundedTotal > 0 && (
            <div className="flex justify-between text-neutral-600">
              <span>{labels.receipt.refunded}</span>
              <span>−{formatKyat(refundedTotal)}</span>
            </div>
          )}
          {remaining > 0 && (
            <div className="flex justify-between font-medium">
              <span>{labels.receipt.remaining}</span>
              <span>{formatKyat(remaining)}</span>
            </div>
          )}
          {credit > 0 && (
            <div className="flex justify-between font-medium">
              <span>{labels.receipt.credit}</span>
              <span>{formatKyat(credit)}</span>
            </div>
          )}
        </div>

        {data.notes && (
          <p className="mt-4 whitespace-pre-line text-sm">📝 {data.notes}</p>
        )}

        <p className="mt-8 whitespace-pre-line text-center text-sm">{footer}</p>
      </div>
    </div>
  );
}
