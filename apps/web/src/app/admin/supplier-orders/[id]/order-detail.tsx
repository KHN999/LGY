"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SupplierOrder } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";

interface Props {
  order: SupplierOrder;
}

export function OrderDetail({ order }: Props) {
  const router = useRouter();
  const editable = order.status !== "RECEIVED" && order.status !== "CANCELLED";
  const canCancel = order.status === "PENDING";
  const received = order.receipts.reduce((s, r) => s + r.receivedQty, 0);
  const remainingQty = Math.max(0, order.expectedQty - received);

  const [openPanel, setOpenPanel] = useState<"none" | "edit" | "payment" | "receipt">("none");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Edit form state
  const [expectedQty, setExpectedQty] = useState(String(order.expectedQty));
  const [expectedTotal, setExpectedTotal] = useState(String(order.expectedTotal));
  const [notes, setNotes] = useState(order.notes ?? "");

  // Payment form state
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<"CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER">("CASH");

  // Receipt form state
  const [recvQty, setRecvQty] = useState(String(remainingQty));
  const [recvGoodsCost, setRecvGoodsCost] = useState("");
  const [recvTransport, setRecvTransport] = useState("0");

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
        expectedTotal: Number(expectedTotal),
        notes: notes.trim() || undefined,
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
      await api.patch(`/supplier-orders/${order.id}`, { status: "CANCELLED" });
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
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "edit" ? "none" : "edit")}
              className="rounded-lg border bg-card px-3 py-2 text-sm hover:bg-accent"
            >
              {labels.common.edit}
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "receipt" ? "none" : "receipt")}
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              {labels.admin.order.recordReceipt}
            </button>
            <button
              type="button"
              onClick={() => setOpenPanel(openPanel === "payment" ? "none" : "payment")}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white"
            >
              {labels.admin.order.recordPayment}
            </button>
            {canCancel && (
              <button
                type="button"
                onClick={() => {
                  if (confirm("Cancel this order?")) cancelOrder();
                }}
                disabled={submitting}
                className="rounded-lg border border-destructive px-3 py-2 text-sm text-destructive disabled:opacity-50"
              >
                {labels.admin.order.cancel}
              </button>
            )}
          </>
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
          <Field label={labels.admin.order.paymentAmount}>
            <input
              autoFocus
              type="number"
              inputMode="numeric"
              min={1}
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
              <option value="CASH">CASH</option>
              <option value="BANK_TRANSFER">BANK_TRANSFER</option>
              <option value="MOBILE_MONEY">MOBILE_MONEY</option>
              <option value="OTHER">OTHER</option>
            </select>
          </Field>
          <Actions
            onCancel={reset}
            onSave={recordPayment}
            submitting={submitting}
            disabled={!payAmount || Number(payAmount) <= 0}
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
            <Field label={"ဈေး (ကျပ်)"}>
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
            {order.receipts.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p>
                    <span className="font-medium">{r.receivedQty}</span>{" "}
                    {labels.units.htee}
                    {" — "}
                    {formatKyat(r.goodsCost)}
                    {r.transportCost > 0 && ` + ${formatKyat(r.transportCost)} သယ်ခ`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.receivedAt).toLocaleString("en-US", { hour12: true })}
                  </p>
                </div>
                <p className="font-semibold">
                  {formatKyat(r.goodsCost + r.transportCost)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Payment history */}
      {order.payments.length > 0 && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-2 text-base font-semibold">{labels.admin.order.recordPayment}</h2>
          <ul className="flex flex-col divide-y">
            {order.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <p className="font-medium">{formatKyat(p.amount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.paymentDate).toLocaleString("en-US", { hour12: true })} · {p.method}
                  </p>
                </div>
              </li>
            ))}
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
      <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">
        {labels.common.cancel}
      </button>
      <button
        type="button"
        onClick={onSave}
        disabled={submitting || disabled}
        className="rounded-lg bg-primary px-6 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? labels.common.saving : labels.common.save}
      </button>
    </div>
  );
}
