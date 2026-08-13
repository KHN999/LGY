"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type SaleDetail,
  type SaleReturnRow,
  type ShopSettings,
} from "@/lib/api-client";
import { Receipt, type ReceiptData } from "@/components/staff/receipt";
import { AddOnFlow } from "./add-on-flow";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";

export function ReceiptView({
  sale,
  returns,
  shop,
  autoPrint = false,
}: {
  sale: SaleDetail;
  returns: SaleReturnRow[];
  shop?: ShopSettings;
  autoPrint?: boolean;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [returning, setReturning] = useState(false);
  const [adding, setAdding] = useState(false);
  const [voidingId, setVoidingId] = useState<number | null>(null);
  const [voidError, setVoidError] = useState<string | null>(null);
  const printedRef = useRef(false);
  useEffect(() => setMounted(true), []);
  // Auto-print once when arriving from "Save & Print" (?print=1). Printing from
  // this fully-loaded receipt page is reliable on mobile — unlike the old in-place
  // print that raced the sell-flow's navigation.
  useEffect(() => {
    if (mounted && autoPrint && !printedRef.current) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [mounted, autoPrint]);

  async function voidReturn(id: number) {
    setVoidingId(id);
    setVoidError(null);
    try {
      await api.post(`/returns/${id}/void`, {});
      router.refresh();
    } catch (err) {
      setVoidError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setVoidingId(null);
    }
  }

  // Fold returns into the receipt so the printed voucher shows the net position
  // (returned goods + refunds), not just the original sale. `returns` is already
  // non-voided (the by-sale endpoint filters them out).
  const returnedLines = returns.flatMap((r) =>
    r.lines.map((l) => ({
      label: l.itemType?.labelMy ?? l.itemName ?? "",
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
  );

  const data: ReceiptData = {
    saleId: sale.id,
    date: sale.saleDate,
    customerName: sale.customer?.name ?? sale.customerName ?? null,
    customerContact: sale.customer?.contact ?? null,
    lines: sale.lines.map((l) => ({
      label: l.itemType?.labelMy ?? l.itemName ?? "",
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      note: l.note,
    })),
    grandTotal: sale.grandTotal,
    paid: sale.paidAmount,
    returnedLines,
    returnedTotal: returns.reduce((s, r) => s + r.returnTotal, 0),
    refundedTotal: returns.reduce((s, r) => s + r.refundAmount, 0),
  };

  const voided = sale.voidedAt != null;
  const remaining = sale.grandTotal - sale.paidAmount;

  return (
    <>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <Receipt data={data} shop={shop} />
      </div>

      {voided && (
        <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
          {labels.salesAdmin.voided}
        </p>
      )}

      {!voided && remaining > 0 && <PaymentPanel saleId={sale.id} remaining={remaining} />}

      {returns.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.returns.existing}</h2>
          {voidError && (
            <p role="alert" className="mb-2 rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              {voidError}
            </p>
          )}
          <ul className="flex flex-col divide-y text-sm">
            {returns.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {formatDate(r.returnDate)} ·{" "}
                    {r.lines.reduce((s, l) => s + l.qty, 0)} {labels.units.htee}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-rose-600">−{formatKyat(r.refundAmount)}</span>
                    {!voided && (
                      <button
                        type="button"
                        onClick={() => voidReturn(r.id)}
                        disabled={voidingId === r.id}
                        className="rounded-lg border px-2 py-1 text-xs text-destructive disabled:opacity-50"
                      >
                        {voidingId === r.id ? labels.common.saving : labels.returns.void}
                      </button>
                    )}
                  </div>
                </div>
                {r.notes && <p className="text-xs text-muted-foreground">📝 {r.notes}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {!voided && returning && (
        <ReturnForm sale={sale} onClose={() => setReturning(false)} />
      )}

      {!voided && adding && <AddOnFlow sale={sale} onClose={() => setAdding(false)} />}

      {/* Clearance so the last content isn't hidden behind the fixed action bar. */}
      <div aria-hidden className="h-24" />

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-2xl border-2 border-emerald-600 py-4 text-sm font-bold text-emerald-700 active:scale-[0.98]"
          >
            🖨 {labels.history.reprint}
          </button>
          {!voided && (
            <button
              type="button"
              onClick={() => {
                setAdding((v) => !v);
                setReturning(false);
              }}
              className="flex-1 rounded-2xl bg-emerald-600 py-4 text-sm font-bold text-white shadow active:scale-[0.98]"
            >
              ➕ {labels.addOn.button}
            </button>
          )}
          {!voided && (
            <button
              type="button"
              onClick={() => {
                setReturning((v) => !v);
                setAdding(false);
              }}
              className="flex-1 rounded-2xl bg-rose-600 py-4 text-sm font-bold text-white shadow active:scale-[0.98]"
            >
              ↩ {labels.returns.action}
            </button>
          )}
        </div>
      </div>

      {mounted &&
        createPortal(
          <div id="print-receipt" className="hidden print:block">
            <Receipt data={data} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** Settle a credit sale — record a payment against it (flips it to PARTIAL/PAID
 *  via POST /sales/:id/payments, which links the payment to this sale). */
function PaymentPanel({ saleId, remaining }: { saleId: number; remaining: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNum = (s: string) => Math.max(0, Math.min(remaining, Math.round(Number(s) || 0)));

  async function submit() {
    const amt = toNum(amount);
    if (amt <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/sales/${saleId}/payments`, { amount: amt, method });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-2xl bg-amber-600 py-4 text-lg font-bold text-white shadow active:scale-[0.98]"
      >
        💵 {labels.salesAdmin.recordPayment} ({formatKyat(remaining)})
      </button>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-amber-300 bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{labels.salesAdmin.recordPayment}</h2>
        <span className="text-sm text-muted-foreground">
          {labels.domain.remaining}: {formatKyat(remaining)}
        </span>
      </div>
      <div className="flex items-center justify-center gap-3">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={remaining}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-48 rounded-xl border bg-background px-4 py-3 text-center text-2xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
        <span className="text-muted-foreground">{labels.units.kyat}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMethod(m)}
            className={
              "rounded-xl border py-2.5 text-base font-semibold transition " +
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border py-3">
          {labels.common.cancel}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy || toNum(amount) <= 0}
          className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"
        >
          {busy ? labels.common.saving : labels.common.save}
        </button>
      </div>
    </section>
  );
}

function ReturnForm({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const router = useRouter();
  const [qtys, setQtys] = useState<Record<number, number>>({});
  const [refund, setRefund] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const returnValue = sale.lines.reduce((s, l) => s + (qtys[l.id] ?? 0) * l.unitPrice, 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const items = sale.lines
      .filter((l) => (qtys[l.id] ?? 0) > 0)
      .map((l) => ({
        saleLineId: l.id,
        ...(l.itemType ? { itemTypeId: l.itemType.id } : { itemName: l.itemName ?? undefined }),
        qty: qtys[l.id]!,
        unitPrice: l.unitPrice,
      }));
    if (items.length === 0) {
      setError(labels.errors.required);
      return;
    }
    const refundAmount = refund.trim() === "" ? returnValue : Math.max(0, Number(refund) || 0);
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/returns", {
        saleId: sale.id,
        items,
        refundAmount,
        notes: note.trim() || undefined,
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border-2 border-rose-300 bg-card p-4"
    >
      <h2 className="text-base font-bold">{labels.returns.title}</h2>
      <ul className="flex flex-col divide-y">
        {sale.lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {l.itemType?.emoji ?? "🧾"} {l.itemType?.labelMy ?? l.itemName}
              </p>
              <p className="text-xs text-muted-foreground">
                {labels.receipt.qty}: {l.qty}
              </p>
            </div>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={l.qty}
              value={qtys[l.id] ?? 0}
              onChange={(e) =>
                setQtys((p) => ({
                  ...p,
                  [l.id]: Math.max(0, Math.min(l.qty, Number(e.target.value) || 0)),
                }))
              }
              className="w-20 rounded-lg border bg-background px-2 py-2 text-center text-lg tabular-nums outline-none focus:ring-2 focus:ring-ring"
            />
          </li>
        ))}
      </ul>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{labels.returns.refund}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={refund}
          onChange={(e) => setRefund(e.target.value)}
          placeholder={String(returnValue)}
          className="rounded-lg border bg-background px-3 py-2 text-lg tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
      </label>

      <input
        type="text"
        maxLength={500}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={labels.returns.reason}
        className="rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">
          {labels.common.cancel}
        </button>
        <button
          type="submit"
          disabled={submitting || returnValue === 0}
          className="flex-1 rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? labels.common.saving : labels.returns.submit}
        </button>
      </div>
    </form>
  );
}
