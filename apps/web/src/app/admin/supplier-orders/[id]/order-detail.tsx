"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SupplierOrder } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { BANKS, bankLabel } from "@/lib/banks";
import { formatKyat, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui";

interface Props {
  order: SupplierOrder;
}

export function OrderDetail({ order }: Props) {
  const router = useRouter();
  const editable = order.status !== "RECEIVED" && order.status !== "CANCELLED";
  // Deletable at any stage — the API reverses its receipts and payments.
  const canCancel = order.status !== "CANCELLED";
  // Paying is allowed after the goods arrive — most orders are paid on arrival.
  // …but never past the order total, and not at all once it is fully paid.
  const owed = Math.max(
    0,
    order.expectedTotal -
      order.payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0),
  );
  const canPay = order.status !== "CANCELLED" && owed > 0;
  const received = order.receipts
    .filter((r) => !r.voidedAt)
    .reduce((s, r) => s + r.receivedQty, 0);
  const remainingQty = Math.max(0, order.expectedQty - received);

  const [openPanel, setOpenPanel] = useState<"none" | "edit" | "payment" | "receipt">("none");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [expectedQty, setExpectedQty] = useState(String(order.expectedQty));
  const [expectedYards, setExpectedYards] = useState(
    order.expectedYards != null ? String(order.expectedYards) : "",
  );
  const [pricePerYard, setPricePerYard] = useState(
    order.pricePerYard != null ? String(order.pricePerYard) : "",
  );
  const [expectedTotal, setExpectedTotal] = useState(String(order.expectedTotal));
  const [notes, setNotes] = useState(order.notes ?? "");
  function recalcTotal(y: string, p: string) {
    const t = (Number(y) || 0) * (Number(p) || 0);
    if (t > 0) setExpectedTotal(String(t));
  }

  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER">("CASH");
  const [payBank, setPayBank] = useState("");
  const [payDate, setPayDate] = useState("");

  // Receipt form state
  const [recvQty, setRecvQty] = useState(String(remainingQty));
  const [recvGoodsCost, setRecvGoodsCost] = useState("");
  const [recvTransport, setRecvTransport] = useState("0");
  const [recvDate, setRecvDate] = useState("");

  function reset() {
    setError(null);
    setOpenPanel("none");
  }

  async function saveEdit() {
    setError(null);
    setSubmitting(true);
    try {
      await api.patch(`/supplier-orders/${order.id}`, {
        expectedQty: Number(expectedQty),
        // null when cleared so the old value doesn't come back
        expectedYards: expectedYards ? Number(expectedYards) : null,
        pricePerYard: pricePerYard ? Number(pricePerYard) : null,
        expectedTotal: Number(expectedTotal),
        notes: notes.trim() || null,
      });
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  async function recordPayment() {
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/supplier-payments`, {
        supplierId: order.supplierId,
        orderId: order.id,
        amount: Number(payAmount),
        method: payMethod,
        bank: payMethod !== "CASH" && payBank ? payBank : undefined,
        paymentDate: ymdToIso(payDate),
      });
      reset();
      setPayAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  async function recordReceipt() {
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/supplier-orders/${order.id}/receipts`, {
        receivedQty: Number(recvQty),
        goodsCost: Number(recvGoodsCost),
        transportCost: Number(recvTransport) || 0,
        receivedAt: ymdToIso(recvDate),
      });
      reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelOrder() {
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/supplier-orders/${order.id}/delete`, {});
      router.push("/admin/supplier-orders");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelReceipt(id: number) {
    if (!confirm(labels.admin.order.cancelReceiptConfirm)) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/supplier-orders/receipts/${id}/cancel`, {});
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelPayment(id: number) {
    if (!confirm(labels.admin.order.cancelPaymentConfirm)) return;
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/supplier-payments/${id}/void`, { reason: "Cancelled" });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {editable && (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpenPanel(openPanel === "edit" ? "none" : "edit")}
            >
              {labels.common.edit}
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => setOpenPanel(openPanel === "receipt" ? "none" : "receipt")}
            >
              {labels.admin.order.recordReceipt}
            </Button>
          </>
        )}
        {canPay && (
          <Button
            type="button"
            variant="primary"
            className="!bg-amber-600 text-white"
            onClick={() => setOpenPanel(openPanel === "payment" ? "none" : "payment")}
          >
            {labels.admin.order.recordPayment}
          </Button>
        )}
        {canCancel && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              if (confirm(labels.admin.order.deleteConfirm)) cancelOrder();
            }}
            disabled={submitting}
          >
            {labels.admin.order.cancel}
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {openPanel === "edit" && (
        <Panel title={labels.common.edit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={labels.admin.order.expectedQty}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                value={expectedQty}
                onChange={(e) => setExpectedQty(e.target.value)}
                className={inp}
              />
            </Field>
            <Field label={labels.admin.order.yards}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={expectedYards}
                onChange={(e) => {
                  setExpectedYards(e.target.value);
                  recalcTotal(e.target.value, pricePerYard);
                }}
                className={inp}
              />
            </Field>
            <Field label={labels.admin.order.pricePerYard}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={pricePerYard}
                onChange={(e) => {
                  setPricePerYard(e.target.value);
                  recalcTotal(expectedYards, e.target.value);
                }}
                className={inp}
              />
            </Field>
            <Field label={labels.admin.order.totalExpected}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={expectedTotal}
                onChange={(e) => setExpectedTotal(e.target.value)}
                className={inp}
              />
            </Field>
          </div>
          <Field label={labels.admin.fields.notes}>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} />
          </Field>
          <Actions onCancel={reset} onSave={saveEdit} submitting={submitting} />
        </Panel>
      )}

      {openPanel === "payment" && (
        <Panel title={labels.admin.order.recordPayment}>
          <Field
            label={`${labels.admin.order.paymentAmount} (${labels.admin.order.remaining}: ${formatKyat(owed)})`}
          >
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={1}
              max={owed}
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              className={inp}
            />
          </Field>
          <Field label={labels.admin.order.paymentMethod}>
            <select
              value={payMethod}
              onChange={(e) =>
                setPayMethod(e.target.value as typeof payMethod)
              }
              className={inp}
            >
              <option value="CASH">💵 {labels.paymentReceipt.methodCash}</option>
              <option value="BANK_TRANSFER">🏦 {labels.paymentReceipt.methodBank}</option>
            </select>
          </Field>
          {payMethod !== "CASH" && (
            <Field label={labels.bankBook.payBank}>
              <select value={payBank} onChange={(e) => setPayBank(e.target.value)} className={inp}>
                <option value="">{labels.paymentReceipt.bankChoose}</option>
                {BANKS.filter((b) => b !== "UNKNOWN").map((b) => (
                  <option key={b} value={b}>
                    {bankLabel(b)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label={labels.admin.order.paymentDate}>
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              className={inp}
            />
          </Field>
          <Actions
            onCancel={reset}
            onSave={recordPayment}
            submitting={submitting}
            disabled={
              !payAmount ||
              Number(payAmount) <= 0 ||
              Number(payAmount) > owed ||
              (payMethod !== "CASH" && !payBank)
            }
          />
        </Panel>
      )}

      {openPanel === "receipt" && (
        <Panel title={labels.admin.order.recordReceipt}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={labels.admin.order.receivedQty}>
              <input
                autoFocus
                type="number"
                inputMode="numeric"
                min={1}
                value={recvQty}
                onChange={(e) => setRecvQty(e.target.value)}
                className={inp}
              />
            </Field>
            <Field label={labels.admin.order.price}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={recvGoodsCost}
                onChange={(e) => setRecvGoodsCost(e.target.value)}
                className={inp}
              />
            </Field>
            <Field label={labels.admin.order.transportCost}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={recvTransport}
                onChange={(e) => setRecvTransport(e.target.value)}
                className={inp}
              />
            </Field>
            <Field label={labels.admin.order.receiptDate}>
              <input
                type="date"
                value={recvDate}
                onChange={(e) => setRecvDate(e.target.value)}
                className={inp}
              />
            </Field>
          </div>
          <Actions
            onCancel={reset}
            onSave={recordReceipt}
            submitting={submitting}
            disabled={!recvQty || Number(recvQty) <= 0 || !recvGoodsCost}
          />
        </Panel>
      )}

      {/* Receipt history */}
      {order.receipts.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 text-base font-semibold">{labels.admin.order.recordReceipt}</h2>
          <ul className="flex flex-col divide-y">
            {order.receipts.map((r) => {
              const voided = r.voidedAt != null;
              return (
                <li
                  key={r.id}
                  className={`flex items-center justify-between gap-2 py-2 text-sm ${voided ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0">
                    <p className={voided ? "line-through" : ""}>
                      <span className="font-medium">{r.receivedQty}</span>{" "}
                      {labels.units.htee}
                      {" — "}
                      {formatKyat(r.goodsCost)}
                      {r.transportCost > 0 && ` + ${formatKyat(r.transportCost)} ${labels.admin.order.transportShort}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(r.receivedAt)}
                      {voided && ` · ${labels.admin.order.cancelled}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className="font-semibold">{formatKyat(r.goodsCost + r.transportCost)}</p>
                    {!voided && (
                      <button
                        type="button"
                        onClick={() => cancelReceipt(r.id)}
                        disabled={submitting}
                        className="rounded-lg border px-2 py-1 text-xs text-destructive disabled:opacity-50"
                      >
                        {labels.admin.order.cancelReceipt}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Payment history */}
      {order.payments.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 text-base font-semibold">{labels.admin.order.recordPayment}</h2>
          <ul className="flex flex-col divide-y">
            {order.payments.map((p) => {
              const voided = p.voidedAt != null;
              return (
                <li
                  key={p.id}
                  className={`flex items-center justify-between gap-2 py-2 text-sm ${voided ? "opacity-50" : ""}`}
                >
                  <div className="min-w-0">
                    <p className={`font-medium ${voided ? "line-through" : ""}`}>{formatKyat(p.amount)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(p.paymentDate)} ·{" "}
                      {p.method === "CASH"
                        ? `💵 ${labels.paymentReceipt.methodCash}`
                        : `🏦 ${labels.paymentReceipt.methodBank}${p.bank ? ` · ${bankLabel(p.bank)}` : ""}`}
                      {voided && ` · ${labels.admin.order.cancelled}`}
                    </p>
                  </div>
                  {!voided && (
                    <button
                      type="button"
                      onClick={() => cancelPayment(p.id)}
                      disabled={submitting}
                      className="shrink-0 rounded-lg border px-2 py-1 text-xs text-destructive disabled:opacity-50"
                    >
                      {labels.admin.order.cancelPayment}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {order.notes && (
        <section className="rounded-2xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">{labels.admin.fields.notes}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{order.notes}</p>
        </section>
      )}
    </div>
  );
}

const inp =
  "rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

// Date-only input → noon Yangon ISO (displays on the chosen day); blank = today.
const ymdToIso = (d: string) =>
  d ? new Date(`${d}T12:00:00+06:30`).toISOString() : undefined;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-primary/30 bg-card p-4">
      <h3 className="text-base font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function Actions({
  onCancel,
  onSave,
  submitting,
  disabled,
}: {
  onCancel: () => void;
  onSave: () => void;
  submitting: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel}>
        {labels.common.cancel}
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={onSave}
        disabled={submitting || disabled}
      >
        {submitting ? labels.common.saving : labels.common.save}
      </Button>
    </div>
  );
}
