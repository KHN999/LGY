"use client";

import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { ShopSettings } from "@/lib/api-client";

export interface TransferSlip {
  transferId: number;
  date: string | Date;
  fromLabel: string;
  toLabel: string;
  lines: { label: string; qty: number }[];
  totalPieces: number;
  delivery?: { by: string; fee: number } | null;
  by?: string | null;
}

/**
 * Transfer note / delivery slip — A5 (same print rules as the sale receipt).
 * No prices; it's a "these goods moved from X to Y" hand-off record.
 */
export function TransferReceipt({ data, shop }: { data: TransferSlip; shop?: ShopSettings }) {
  const d = new Date(data.date);
  const shopName = shop?.shopName?.trim() || labels.receipt.shopName;

  return (
    <div className="mx-auto w-full max-w-[150mm] bg-white p-6 text-black">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold tracking-wide">{shopName}</h2>
        <p className="mt-1 text-sm font-medium text-neutral-700">{labels.transfer.slipTitle}</p>
        {shop?.addressLine?.trim() && <p className="text-xs text-neutral-600">{shop.addressLine}</p>}
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <span>
          {labels.receipt.no}: {data.transferId}
        </span>
        <span>{d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
      </div>
      <p className="mt-2 text-center text-base font-semibold">
        {data.fromLabel} → {data.toLabel}
      </p>

      <table className="mt-4 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-black">
            <th className="py-1 text-left font-semibold">{labels.receipt.item}</th>
            <th className="py-1 text-right font-semibold">{labels.receipt.qty}</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((l, i) => (
            <tr key={i} className="border-b border-neutral-300">
              <td className="py-1 pr-2">{l.label}</td>
              <td className="py-1 text-right tabular-nums">{l.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-between border-t-2 border-black pt-1 text-base font-bold">
        <span>{labels.transfer.totalPieces}</span>
        <span className="tabular-nums">
          {data.totalPieces} {labels.units.htee}
        </span>
      </div>

      {data.delivery && (
        <div className="mt-3 flex justify-between text-sm">
          <span>
            🚚 {labels.transfer.driver}: {data.delivery.by}
          </span>
          <span className="tabular-nums">{formatKyat(data.delivery.fee)}</span>
        </div>
      )}

      {data.by && <p className="mt-8 text-sm text-neutral-600">— {data.by}</p>}
    </div>
  );
}
