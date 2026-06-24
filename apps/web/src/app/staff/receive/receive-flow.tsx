"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  api,
  ApiError,
  type Customer,
  type PaymentResult,
  type ShopSettings,
} from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { speak } from "@/lib/speech";
import { CustomerPicker } from "@/components/staff/customer-picker";
import { PaymentReceipt, type PaymentReceiptData } from "@/components/staff/payment-receipt";
import { useStaffDate } from "@/components/staff/staff-date";

export function ReceiveMoneyFlow({ shop }: { shop?: ShopSettings }) {
  const router = useRouter();
  const { backdateIso, resetToToday } = useStaffDate();
  const params = useSearchParams();
  const initialCustomerName = params.get("customerName");
  const initialCustomerId = params.get("customerId");
  const initialBalance = Number(params.get("balance") ?? "0");

  const [customer, setCustomer] = useState<Customer | null>(
    initialCustomerName && initialCustomerId
      ? ({
          id: Number(initialCustomerId),
          name: initialCustomerName,
          balance: initialBalance,
          contact: null,
          photoUrl: null,
          defaultKind: "WHOLESALE",
          notes: null,
          status: "ACTIVE",
        } as Customer)
      : null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PaymentReceiptData | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  async function onSubmit() {
    if (!customer) {
      setError(labels.sell.noCustomer);
      return;
    }
    if (amount <= 0) {
      setError(labels.errors.required);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await api.post<PaymentResult>("/customer-payments", {
        customerId: customer.id,
        amount,
        method,
        paymentDate: backdateIso(),
      });
      resetToToday();
      speak(labels.receive.voiceReceived(formatKyat(amount)));
      setDone({
        paymentId: res.id,
        date: res.paymentDate,
        customerName: res.customerName,
        amount: res.amount,
        method: res.method,
        balanceAfter: res.balanceAfter,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  // After recording: show the printable payment receipt to hand the payer.
  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 sm:p-6">
        <p className="rounded-xl bg-emerald-100 p-3 text-center font-semibold text-emerald-900">
          ✓ {formatKyat(done.amount)} · {labels.paymentReceipt.remaining}: {formatKyat(done.balanceAfter)}
        </p>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <PaymentReceipt data={done} shop={shop} />
        </div>
        <div className="flex gap-3 pb-4">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded-2xl border-2 border-emerald-600 py-4 text-lg font-bold text-emerald-700 active:scale-[0.98]"
          >
            🖨 {labels.common.print}
          </button>
          <button
            type="button"
            onClick={() => router.push("/staff?saved=receive")}
            className="flex-1 rounded-2xl bg-primary py-4 text-lg font-bold text-primary-foreground active:scale-[0.98]"
          >
            {labels.common.done}
          </button>
        </div>

        {mounted &&
          createPortal(
            <div id="print-receipt" className="hidden print:block">
              <PaymentReceipt data={done} shop={shop} />
            </div>,
            document.body,
          )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/staff" className="rounded-lg border px-4 py-2">
          ← {labels.common.back}
        </Link>
        <Link href="/staff/receive/history" className="rounded-lg border px-4 py-2 text-sm">
          📋 {labels.receive.history}
        </Link>
      </div>
      <h1 className="text-center text-2xl font-bold">{labels.receive.title}</h1>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">{labels.domain.customer}</p>
        {customer ? (
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xl font-semibold">{customer.name}</p>
              <p
                className={
                  "text-sm " + (customer.balance > 0 ? "text-rose-600" : "text-muted-foreground")
                }
              >
                {labels.domain.debt}: {formatKyat(customer.balance)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {labels.sell.changeCustomer}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="w-full rounded-xl bg-primary py-5 text-xl font-semibold text-primary-foreground"
          >
            {labels.receive.chooseCustomer}
          </button>
        )}
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-3 text-center text-sm text-muted-foreground">{labels.receive.amount}</p>
        <div className="flex items-center justify-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount || ""}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="w-56 rounded-xl border bg-background px-4 py-3 text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-lg text-muted-foreground">{labels.units.kyat}</span>
        </div>
        {customer && customer.balance > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={() => setAmount(customer.balance)}
              className="rounded-lg border bg-card px-3 py-1 text-sm"
            >
              {labels.receive.payAll} ({formatKyat(customer.balance)})
            </button>
            {[10000, 50000, 100000, 500000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className="rounded-lg border bg-card px-3 py-1 text-sm"
              >
                {formatKyat(v)}
              </button>
            ))}
          </div>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={
                "rounded-xl border py-3 text-base font-semibold transition " +
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
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !customer || amount <= 0}
        className="rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98]"
      >
        {submitting ? labels.common.saving : labels.common.save}
      </button>

      {/* Receiving money = collecting debt → only show customers who owe. */}
      <CustomerPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={setCustomer}
        debtorsOnly
      />
    </main>
  );
}
