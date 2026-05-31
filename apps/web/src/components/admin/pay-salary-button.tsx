"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { Button } from "@/components/ui";

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/**
 * One-tap "Pay salary" → records a `salary` Expense paid to this employee
 * (amount pre-filled to their monthly salary, editable). Flows into the
 * employee's activity + the daily close like any expense.
 */
export function PaySalaryButton({
  employeeId,
  defaultAmount,
  categoryId,
  compact,
}: {
  employeeId: number;
  defaultAmount: number | null;
  categoryId: number;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(defaultAmount != null ? String(defaultAmount) : "");
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState<number | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) {
      setError(labels.errors.required);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/expenses", {
        categoryId,
        amount: amt,
        paidToEmployeeId: employeeId,
        expenseDate: date,
      });
      setOpen(false);
      setPaid(amt);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  // Success state — clear confirmation; tap to pay again.
  if (paid !== null && !open) {
    return (
      <button
        type="button"
        onClick={() => {
          setPaid(null);
          setOpen(true);
        }}
        className="shrink-0 rounded-lg border-2 border-emerald-500 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700"
      >
        ✓ {labels.common.saved} · {formatKyat(paid)}
      </button>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        size="sm"
        variant={compact ? "outline" : "primary"}
        className="shrink-0"
        onClick={() => setOpen(true)}
      >
        💵 {compact ? labels.expenses.pay : labels.expenses.paySalary}
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2"
    >
      <input
        type="number"
        inputMode="numeric"
        min={0}
        autoFocus
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
        className="w-28 rounded-lg border bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="rounded-lg border bg-background px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <Button type="submit" size="sm" disabled={busy}>
        {busy ? labels.common.saving : labels.common.save}
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
      >
        {labels.common.cancel}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
