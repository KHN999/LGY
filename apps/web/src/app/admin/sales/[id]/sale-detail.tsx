"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SaleDetail } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";

export function SaleDetailActions({ sale }: { sale: SaleDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const voided = sale.voidedAt != null;

  return (
    <>
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
                    {new Date(p.paymentDate).toLocaleDateString("en-US")} · {p.method}
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "rounded-lg border border-destructive text-destructive " +
          (big ? "self-start px-6 py-2 font-semibold" : "px-3 py-1 text-xs")
        }
      >
        {label}
      </button>
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
        <button
          type="submit"
          disabled={busy || reason.trim().length < 2}
          className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy ? labels.common.saving : labels.salesAdmin.confirm}
        </button>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          {labels.common.cancel}
        </button>
      </div>
    </form>
  );
}
