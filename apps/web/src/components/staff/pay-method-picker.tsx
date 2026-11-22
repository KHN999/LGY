"use client";

import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { BANKS, bankLabel, type BankCode } from "@/lib/banks";

/** How an amount is tendered: all cash, all bank, or part cash + the rest bank. */
export type PayMode = "CASH" | "BANK_TRANSFER" | "SPLIT";
export interface PayChoice {
  mode: PayMode;
  /** Cash portion — only meaningful in SPLIT mode. */
  cash: number;
  /** Which bank the transfer came through ("" = not chosen yet). */
  bank: BankCode | "";
}
export const DEFAULT_PAY: PayChoice = { mode: "CASH", cash: 0, bank: "" };

/** Why this choice can't be saved yet, or null when it is complete. A split
 *  needs a real amount on both sides; any bank part needs its bank chosen. */
export function payError(total: number, c: PayChoice): string | null {
  if (c.mode === "SPLIT" && !(c.cash > 0 && c.cash < total)) {
    return labels.paymentReceipt.splitHint;
  }
  if (c.mode !== "CASH" && !c.bank) return labels.paymentReceipt.bankRequired;
  return null;
}

/** Bank-transfer portion of `total` for this choice (for receipts). */
export function bankPart(total: number, c: PayChoice): number {
  if (c.mode === "BANK_TRANSFER") return total;
  if (c.mode === "SPLIT") return Math.max(0, total - c.cash);
  return 0;
}

/** The method / bankAmount fields the payment endpoints expect. */
export function payFields(
  total: number,
  c: PayChoice,
): { method: "CASH" | "BANK_TRANSFER"; bankAmount?: number; bank?: BankCode } {
  const bank = c.mode !== "CASH" && c.bank ? c.bank : undefined;
  if (c.mode === "SPLIT") return { method: "CASH", bankAmount: bankPart(total, c), bank };
  return { method: c.mode, bank };
}

const MODES: { mode: PayMode; icon: string; label: string }[] = [
  { mode: "CASH", icon: "💵", label: labels.paymentReceipt.methodCash },
  { mode: "BANK_TRANSFER", icon: "🏦", label: labels.paymentReceipt.methodBank },
  { mode: "SPLIT", icon: "➗", label: labels.paymentReceipt.methodSplit },
];

/**
 * Cash / Bank / Split chooser. In split mode staff type only the cash part; the
 * bank part is whatever is left of `total`.
 */
export function PayMethodPicker({
  total,
  value,
  onChange,
}: {
  total: number;
  value: PayChoice;
  onChange: (c: PayChoice) => void;
}) {
  const bank = bankPart(total, value);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button
            key={m.mode}
            type="button"
            onClick={() => onChange({ ...value, mode: m.mode })}
            className={
              "rounded-xl border px-1 py-2.5 text-base font-semibold transition " +
              (value.mode === m.mode
                ? "border-2 border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-border bg-card text-muted-foreground")
            }
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>
      {value.mode === "SPLIT" && (
        <div className="flex flex-col gap-2 rounded-xl border bg-background p-3">
          <label className="flex items-center justify-between gap-3">
            <span className="text-base">💵 {labels.paymentReceipt.methodCash}</span>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={total}
              value={value.cash || ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  cash: Math.max(0, Math.min(total, Math.round(Number(e.target.value) || 0))),
                })
              }
              placeholder="0"
              className="w-40 rounded-lg border bg-card px-3 py-2 text-right text-xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-base">🏦 {labels.paymentReceipt.methodBank}</span>
            <span className="text-xl font-bold tabular-nums">{formatKyat(bank)}</span>
          </div>
          {!(value.cash > 0 && value.cash < total) && (
            <p className="text-sm text-muted-foreground">{labels.paymentReceipt.splitHint}</p>
          )}
        </div>
      )}
      {value.mode !== "CASH" && (
        <select
          id="pay-bank"
          aria-label={labels.paymentReceipt.bankChoose}
          value={value.bank}
          onChange={(e) => onChange({ ...value, bank: e.target.value as BankCode | "" })}
          className={
            "w-full rounded-xl border bg-background px-3 py-3 text-base font-semibold outline-none focus:ring-2 focus:ring-ring " +
            (value.bank ? "" : "border-amber-500 text-muted-foreground")
          }
        >
          <option value="">🏦 {labels.paymentReceipt.bankChoose}</option>
          {BANKS.map((b) => (
            <option key={b} value={b}>
              {bankLabel(b)}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
