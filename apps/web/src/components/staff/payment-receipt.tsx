import type { ShopSettings } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat, formatDateTime } from "@/lib/utils";
import { ReceiptHeader, ReceiptWatermark } from "./receipt";

export interface PaymentReceiptData {
  paymentId: number;
  date: string | Date;
  customerName: string;
  amount: number;
  method: string;
  /** Authoritative remaining debt after this payment. */
  balanceAfter: number;
  by?: string | null;
}

const METHOD_LABEL: Record<string, string> = {
  CASH: labels.paymentReceipt.methodCash,
  BANK_TRANSFER: labels.paymentReceipt.methodBank,
  MOBILE_MONEY: labels.paymentReceipt.methodMobile,
  OTHER: labels.paymentReceipt.methodOther,
};

/**
 * Payment voucher handed to the payer when they settle (part of) their debt.
 * Shares the shop header with the sale receipt; the body is amount-received +
 * before/after balance instead of line items. A5 (same print rules).
 */
export function PaymentReceipt({
  data,
  shop,
}: {
  data: PaymentReceiptData;
  shop?: ShopSettings;
}) {
  const d = new Date(data.date);
  const footer = shop?.receiptFooter?.trim() || labels.receipt.thanks;
  const previousDebt = data.balanceAfter + data.amount;

  return (
    <div className="relative mx-auto w-full max-w-[150mm] overflow-hidden bg-white p-6 text-black">
      <ReceiptWatermark />

      <div className="relative z-10">
        <ReceiptHeader shop={shop} />

        <p className="mt-3 border-y-2 border-black py-1 text-center text-base font-bold uppercase tracking-wide">
          {labels.paymentReceipt.title}
        </p>

        <div className="mt-3 flex justify-between text-sm">
          <span>
            {labels.receipt.no}: {data.paymentId}
          </span>
          <span>{formatDateTime(d)}</span>
        </div>
        <div className="text-sm">
          {labels.receipt.customer}: <span className="font-medium">{data.customerName}</span>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t-2 border-black pt-2">
          <span className="text-lg font-bold">{labels.paymentReceipt.received}</span>
          <span className="text-2xl font-extrabold tabular-nums">{formatKyat(data.amount)}</span>
        </div>
        <div className="flex justify-between text-sm text-neutral-700">
          <span>{labels.paymentReceipt.method}</span>
          <span>{METHOD_LABEL[data.method] ?? data.method}</span>
        </div>

        <div className="mt-4 ml-auto w-2/3 space-y-1 text-sm sm:w-1/2">
          <div className="flex justify-between text-neutral-700">
            <span>{labels.paymentReceipt.previousDebt}</span>
            <span className="tabular-nums">{formatKyat(previousDebt)}</span>
          </div>
          <div className="flex justify-between border-t-2 border-black pt-1 text-base font-bold">
            <span>{labels.paymentReceipt.remaining}</span>
            <span className="tabular-nums">{formatKyat(data.balanceAfter)}</span>
          </div>
        </div>

        <p className="mt-8 whitespace-pre-line text-center text-sm">{footer}</p>
        {data.by && <p className="mt-1 text-right text-xs text-neutral-600">— {data.by}</p>}
      </div>
    </div>
  );
}
