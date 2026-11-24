"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { BANKS, bankLabel } from "@/lib/banks";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button } from "@/components/ui";

const L = labels.bankBook;
type Mode = "DEPOSIT" | "WITHDRAW" | "SET_BALANCE";
const NAMED = BANKS.filter((b) => b !== "UNKNOWN");
const todayYmd = () => new Date(Date.now() + 390 * 60_000).toISOString().slice(0, 10);

/** Deposit / withdraw / set-balance buttons with one shared inline form. */
export function BankActions({
  defaultBank,
  balances,
}: {
  defaultBank: string | null;
  balances: Record<string, number>;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [bank, setBank] = useState<string>(defaultBank && defaultBank !== "UNKNOWN" ? defaultBank : NAMED[0]!);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [cashSide, setCashSide] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(m: Mode) {
    setMode(mode === m ? null : m);
    setAmount("");
    setNotes("");
    setDate(todayYmd());
    setCashSide(true);
    setError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!mode) return;
    const amt = Math.round(Number(amount));
    if (amount.trim() === "" || !Number.isFinite(amt) || amt < (mode === "SET_BALANCE" ? 0 : 1)) {
      setError(labels.errors.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post(`/bank/txns`, {
        bank,
        type: mode,
        amount: amt,
        cashSide: mode === "SET_BALANCE" ? undefined : cashSide,
        // Today → let the server stamp "now", so it lands after a balance set earlier today.
        txnDate:
          mode !== "SET_BALANCE" && date && date !== todayYmd()
            ? new Date(`${date}T12:00:00+06:30`).toISOString()
            : undefined,
        notes: notes.trim() || undefined,
      });
      setMode(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  const tab = (m: Mode, icon: string, text: string) => (
    <button
      type="button"
      onClick={() => open(m)}
      className={
        "rounded-xl px-4 py-2.5 text-sm font-semibold transition " +
        (mode === m ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
      }
    >
      {icon} {text}
    </button>
  );
  const preview = Number(amount) > 0 && mode && mode !== "SET_BALANCE";
  const current = balances[bank] ?? 0;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {tab("DEPOSIT", "➕", L.deposit)}
        {tab("WITHDRAW", "➖", L.withdraw)}
        {tab("SET_BALANCE", "⚙️", L.setBalance)}
      </div>
      {mode && (
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
          {mode === "SET_BALANCE" && <p className="text-sm text-muted-foreground">{L.setHint}</p>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label={L.bank}>
              <select value={bank} onChange={(e) => setBank(e.target.value)} className={inputClass}>
                {NAMED.map((b) => (
                  <option key={b} value={b}>
                    {bankLabel(b)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={mode === "SET_BALANCE" ? L.newBalance : L.amount}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                autoFocus
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={inputClass}
              />
            </Field>
            {mode !== "SET_BALANCE" && (
              <Field label={L.date}>
                <input
                  type="date"
                  value={date}
                  max={todayYmd()}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </Field>
            )}
          </div>
          {mode !== "SET_BALANCE" && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={cashSide}
                onChange={(e) => setCashSide(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span>
                <span className="font-semibold">{mode === "DEPOSIT" ? L.depositFromCash : L.withdrawToCash}</span>
                <span className="block text-xs text-muted-foreground">
                  {mode === "DEPOSIT" ? L.depositFromCashHint : L.withdrawToCashHint}
                </span>
              </span>
            </label>
          )}
          <Field label={L.note}>
            <input
              type="text"
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
            />
          </Field>
          {preview && (
            <p className="text-sm tabular-nums text-muted-foreground">
              {bankLabel(bank)}: {formatKyat(current)} →{" "}
              <span className="font-semibold text-foreground">
                {formatKyat(current + (mode === "DEPOSIT" ? 1 : -1) * Math.round(Number(amount)))}
              </span>
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {L.save}
            </Button>
            <Button type="button" variant="outline" onClick={() => setMode(null)} disabled={busy}>
              {L.cancel}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}

/** Remove a manual entry (deposit / withdrawal / balance set). */
export function RemoveBankTxn({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(L.removeConfirm)) return;
        setBusy(true);
        try {
          await api.post(`/bank/txns/${id}/void`, {});
          router.refresh();
        } catch (err) {
          window.alert(err instanceof ApiError ? err.message : labels.errors.unknown);
        } finally {
          setBusy(false);
        }
      }}
      className="text-xs text-muted-foreground underline underline-offset-2 hover:text-destructive disabled:opacity-50"
    >
      {L.remove}
    </button>
  );
}
