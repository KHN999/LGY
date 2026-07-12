"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SaleDetail } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui";

export function SaleDetailActions({ sale }: { sale: SaleDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const voided = sale.voidedAt != null;
  const remaining = sale.grandTotal - sale.paidAmount;

  return (
    <>
      {!voided && remaining > 0 && (
        <RecordPayment
          saleId={sale.id}
          remaining={remaining}
          onError={setError}
          onDone={() => router.refresh()}
        />
      )}
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-2 text-sm font-semibold">{labels.salesAdmin.payments}</h2>
        {sale.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{labels.salesAdmin.noPayments}</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {sale.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <p className="font-medium">{formatKyat(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(p.paymentDate)} · {p.method}
                  </p>
                </div>
                {!voided && (
                  <VoidButton
                    label={labels.salesAdmin.voidPayment}
                    onVoid={(reason) => api.post(`/customer-payments/${p.id}/void`, { reason })}
                    onDone={() => router.refresh()}
                    onError={setError}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {voided ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          {labels.salesAdmin.voided}
          {sale.voidReason ? ` — ${sale.voidReason}` : ""}
        </p>
      ) : (
        <VoidButton
          big
          label={labels.salesAdmin.voidSale}
          confirmText={labels.salesAdmin.voidSaleConfirm}
          onVoid={(reason) => api.post(`/sales/${sale.id}/void`, { reason })}
          onDone={() => router.refresh()}
          onError={setError}
        />
      )}
    </>
  );
}

/** Record a payment against this sale (settle a credit sale) — flips its status
 *  to PARTIAL/PAID. Uses POST /sales/:id/payments, which links the payment. */
function RecordPayment({
  saleId,
  remaining,
  onError,
  onDone,
}: {
  saleId: number;
  remaining: number;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const amt = Math.max(0, Math.min(remaining, Math.round(Number(amount) || 0)));
    if (amt <= 0) return;
    setBusy(true);
    try {
      await api.post(`/sales/${saleId}/payments`, { amount: amt, method });
      setOpen(false);
      onDone();
    } catch (e) {
      onError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" variant="primary" className="self-start" onClick={() => setOpen(true)}>
        💵 {labels.salesAdmin.recordPayment}
      </Button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-300 bg-card p-4">
      <h3 className="text-sm font-semibold">{labels.salesAdmin.recordPayment}</h3>
      <label className="flex items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {labels.domain.remaining}: {formatKyat(remaining)}
        </span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={remaining}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-32 rounded-lg border bg-background px-3 py-2 text-right text-lg tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={
              "rounded-xl border py-2 text-sm font-semibold transition " +
              (method === m
                ? "border-2 border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-border bg-card text-muted-foreground")
            }
          >
            {m === "CASH"
              ? `💵 ${labels.paymentReceipt.methodCash}`
              : `🏦 ${labels.paymentReceipt.methodBank}`}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
          {labels.common.cancel}
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={submit}
          disabled={busy || Math.round(Number(amount) || 0) <= 0}
        >
          {busy ? labels.common.saving : labels.common.save}
        </Button>
      </div>
    </section>
  );
}

function VoidButton({
  label,
  big,
  confirmText,
  onVoid,
  onDone,
  onError,
}: {
  label: string;
  big?: boolean;
  confirmText?: string;
  onVoid: (reason: string) => Promise<unknown>;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 2) return;
    setBusy(true);
    try {
      await onVoid(reason.trim());
      setOpen(false);
      setReason("");
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="destructive"
        size={big ? "lg" : "sm"}
        onClick={() => setOpen(true)}
        className={big ? "self-start" : undefined}
      >
        {label}
      </Button>
    );
  }

  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 rounded-lg border border-destructive/40 p-3">
      {confirmText && <p className="text-sm text-muted-foreground">{confirmText}</p>}
      <input
        type="text"
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={labels.salesAdmin.reason}
        maxLength={500}
        className="rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
      />
      <div className="flex gap-2">
        <Button
          type="submit"
          variant="destructive"
          disabled={busy || reason.trim().length < 2}
        >
          {busy ? labels.common.saving : labels.salesAdmin.confirm}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
        >
          {labels.common.cancel}
        </Button>
      </div>
    </form>
  );
}
