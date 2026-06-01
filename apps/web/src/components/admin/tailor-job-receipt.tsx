"use client";

import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { ShopSettings } from "@/lib/api-client";

export interface TailorJobSlip {
  jobId: number;
  kind: "TAILOR_SEND" | "TAILOR_RETURN";
  date: string | Date;
  tailorName: string;
  sent: { label: string; qty: number }[];
  received: { label: string; qty: number }[];
  loss: number;
  fee: number;
  by?: string | null;
}

/** Printable tailoring slip (A5) — send or receive. */
export function TailorJobReceipt({ data, shop }: { data: TailorJobSlip; shop?: ShopSettings }) {
  const d = new Date(data.date);
  const shopName = shop?.shopName?.trim() || labels.receipt.shopName;
  const isReceive = data.kind === "TAILOR_RETURN";

  return (
    <div className="mx-auto w-full max-w-[150mm] bg-white p-6 text-black">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold tracking-wide">{shopName}</h2>
        <p className="mt-1 text-sm font-medium text-neutral-700">
          {isReceive ? labels.tailorWork.receiveSlip : labels.tailorWork.sendSlip}
        </p>
      </div>

      <div className="mt-4 flex justify-between text-sm">
        <span>
          {labels.receipt.no}: {data.jobId}
        </span>
        <span>{d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}</span>
      </div>
      <div className="text-sm">
        {labels.domain.tailor}: <span className="font-medium">{data.tailorName}</span>
      </div>

      <Section title={isReceive ? labels.tailorWork.sentQty : labels.tailorWork.send} lines={data.sent} />
      {isReceive && (
        <Section title={labels.tailorWork.receivedQty} lines={data.received} />
      )}

      {isReceive && (
        <div className="mt-4 ml-auto w-2/3 space-y-1 text-sm sm:w-1/2">
          <div className="flex justify-between">
            <span>{labels.tailorWork.loss}</span>
            <span className="tabular-nums">
              {data.loss} {labels.units.htee}
            </span>
          </div>
          <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
            <span>{labels.tailorWork.fee}</span>
            <span className="tabular-nums">{formatKyat(data.fee)}</span>
          </div>
        </div>
      )}

      {data.by && <p className="mt-8 text-sm text-neutral-600">— {data.by}</p>}
    </div>
  );
}

function Section({ title, lines }: { title: string; lines: { label: string; qty: number }[] }) {
  if (lines.length === 0) return null;
  return (
    <table className="mt-4 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b-2 border-black">
          <th className="py-1 text-left font-semibold">{title}</th>
          <th className="py-1 text-right font-semibold">{labels.receipt.qty}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={i} className="border-b border-neutral-300">
            <td className="py-1 pr-2">{l.label}</td>
            <td className="py-1 text-right tabular-nums">{l.qty}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
