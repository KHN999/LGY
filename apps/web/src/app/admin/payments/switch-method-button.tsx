"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { BANKS, bankLabel } from "@/lib/banks";
import { labels } from "@/lib/labels";

const btn = "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50";

/** Correct a received payment's method: cash ↔ bank transfer (admin). Going to
 *  bank asks which bank. A payment on an already-closed day shows a warning first. */
export function SwitchMethodButton({
  id,
  isBank,
  dayClosed,
}: {
  id: number;
  isBank: boolean;
  dayClosed: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bank, setBank] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.post(
        `/customer-payments/${id}/method`,
        isBank ? { method: "CASH" } : { method: "BANK_TRANSFER", bank },
      );
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn}>
        {isBank ? labels.expenses.switchToCash : labels.expenses.switchToBank}
      </button>
    );
  }

  return (
    <div className="flex max-w-xs shrink-0 flex-col gap-2 rounded-xl border bg-background p-2">
      {dayClosed && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs leading-relaxed text-amber-950">
          ⚠ {labels.expenses.switchClosedWarn}
        </p>
      )}
      {isBank ? (
        <p className="text-xs">{labels.expenses.switchConfirmCash}</p>
      ) : (
        <select
          autoFocus
          value={bank}
          onChange={(e) => setBank(e.target.value)}
          className="rounded-lg border bg-background px-2 py-1.5 text-xs"
        >
          <option value="">{labels.paymentReceipt.bankChoose}</option>
          {BANKS.filter((b) => b !== "UNKNOWN").map((b) => (
            <option key={b} value={b}>
              {bankLabel(b)}
            </option>
          ))}
        </select>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || (!isBank && !bank)}
          className="rounded-lg bg-primary px-2 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? labels.common.saving : isBank ? labels.expenses.switchToCash : labels.expenses.switchConfirmBank}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-lg border px-2 py-1.5 text-xs">
          {labels.common.cancel}
        </button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
