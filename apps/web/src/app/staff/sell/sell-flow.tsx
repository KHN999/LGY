"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type Customer,
  type ItemType,
  type SaleKind,
} from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { speak } from "@/lib/speech";
import { CustomerPicker } from "@/components/staff/customer-picker";
import { ItemTypeGrid } from "@/components/staff/item-type-grid";
import { QtyStepper } from "@/components/staff/qty-stepper";

type Step = "customer" | "items" | "review" | "done";

interface CartLine {
  itemType: ItemType;
  qty: number;
  unitPrice: number;
  stock: number;
}

/**
 * Cash-register sell flow:
 *   customer → items (loop: pick type → qty → price) → review (paid) → save
 *   no typing required for happy path; voice confirms on save.
 */
export function SellFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("customer");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [kind, setKind] = useState<SaleKind>("WHOLESALE");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [draft, setDraft] = useState<{
    type: ItemType;
    stock: number;
    qty: number;
    price: number;
  } | null>(null);
  const [paid, setPaid] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const goodsTotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const remaining = goodsTotal - paid;

  function startAddItem(type: ItemType, stock: number) {
    setDraft({ type, stock, qty: 1, price: 0 });
  }
  function commitDraft() {
    if (!draft) return;
    // Shop sales never block on stock (physical-is-truth). Overselling is allowed;
    // the backend records a StockException for back-office reconciliation.
    if (draft.qty <= 0) return;
    setError(null);
    setCart((prev) => [
      ...prev,
      { itemType: draft.type, qty: draft.qty, unitPrice: draft.price, stock: draft.stock },
    ]);
    setDraft(null);
  }
  function removeLine(i: number) {
    setCart((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit() {
    if (!customer) {
      setError(labels.sell.noCustomer);
      return;
    }
    if (cart.length === 0) {
      setError(labels.sell.noItems);
      return;
    }
    if (paid > goodsTotal) {
      setError(labels.sell.cantPayMore);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/sales", {
        customerId: customer.id,
        kind,
        items: cart.map((l) => ({
          itemTypeId: l.itemType.id,
          qty: l.qty,
          unitPrice: l.unitPrice,
        })),
        paidAmount: paid > 0 ? paid : undefined,
        paymentMethod: paid > 0 ? "CASH" : undefined,
      });
      // Voice confirmation — best-effort, silent on devices without my-MM.
      const totalPieces = cart.reduce((s, l) => s + l.qty, 0);
      const firstLabel = cart[0]?.itemType.labelMy ?? labels.units.htee;
      speak(labels.sell.voicePiecesSold(totalPieces, firstLabel));
      router.push("/staff?saved=sell");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── STEP 1: Pick customer ────────────────────────────────────────
  if (step === "customer") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 sm:p-6">
        <BackLink href="/staff" />
        <h1 className="text-center text-2xl font-bold">{labels.sell.pickCustomer}</h1>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="rounded-2xl bg-primary px-8 py-6 text-2xl font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
          >
            {customer ? customer.name : labels.sell.pickCustomer}
          </button>
        </div>
        {customer && (
          <div className="rounded-2xl border bg-card p-4 text-center">
            <p className="text-sm text-muted-foreground">{labels.sell.currentDebt}</p>
            <p className={"text-xl font-semibold " + (customer.balance > 0 ? "text-rose-600" : "")}>
              {formatKyat(customer.balance)}
            </p>
            <button
              type="button"
              onClick={() => {
                setKind(customer.defaultKind);
                setStep("items");
              }}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-4 text-xl font-semibold text-white shadow active:scale-95"
            >
              {labels.common.next}
            </button>
          </div>
        )}
        <CustomerPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(c) => {
            setCustomer(c);
            setKind(c.defaultKind);
          }}
        />
      </main>
    );
  }

  // ─── STEP 2: Pick items ───────────────────────────────────────────
  if (step === "items") {
    if (draft) {
      return (
        <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 sm:p-6">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setError(null);
            }}
            className="self-start rounded-lg border px-4 py-2"
          >
            ← {labels.common.back}
          </button>
          <div className="rounded-2xl border bg-card p-4 text-center">
            <span className="text-5xl">{draft.type.emoji}</span>
            <h2 className="mt-2 text-xl font-bold">{draft.type.labelMy}</h2>
            <p className="text-xs text-muted-foreground">
              {labels.sell.inStock}: {draft.stock}
            </p>
          </div>

          <div>
            <p className="mb-3 text-center text-base text-muted-foreground">{labels.sell.chooseQty}</p>
            <QtyStepper
              value={draft.qty}
              onChange={(qty) => setDraft({ ...draft, qty })}
              showJumps
            />
          </div>

          <div>
            <p className="mb-3 text-center text-base text-muted-foreground">{labels.sell.choosePrice}</p>
            <div className="flex items-center justify-center gap-3">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.price || ""}
                onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) || 0 })}
                placeholder="0"
                className="w-48 rounded-xl border bg-background px-4 py-3 text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-lg text-muted-foreground">{labels.units.kyat}</span>
            </div>
            <p className="mt-2 text-center text-sm text-muted-foreground">
              {labels.common.total}: {formatKyat(draft.qty * draft.price)}
            </p>
          </div>

          {draft.qty > draft.stock && (
            <p className="rounded-lg bg-amber-100 p-3 text-center text-sm text-amber-900">
              {labels.sell.oversellNote}
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={commitDraft}
            disabled={draft.qty <= 0 || draft.price < 0}
            className="rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98]"
          >
            {labels.common.add}
          </button>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32 sm:p-6">
        <button
          type="button"
          onClick={() => setStep("customer")}
          className="self-start rounded-lg border px-4 py-2"
        >
          ← {labels.common.back}
        </button>

        <div className="rounded-2xl border bg-card p-3 text-sm">
          <span className="text-muted-foreground">{labels.domain.customer}: </span>
          <span className="font-semibold">{customer?.name}</span>
          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
            {kind === "WHOLESALE" ? labels.sell.wholesale : labels.sell.retail}
          </span>
        </div>

        <h1 className="text-center text-xl font-bold">{labels.sell.pickItem}</h1>
        <ItemTypeGrid locationForStock="SHOP" hideZeroStock onPick={startAddItem} minStock={1} />

        {cart.length > 0 && (
          <section className="rounded-2xl border bg-card p-3">
            <p className="mb-2 text-sm font-semibold">{labels.sell.cartEmpty.replace("မထည့်", "ထည့်")} ({cart.length})</p>
            <ul className="flex flex-col divide-y">
              {cart.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {l.itemType.emoji} {l.itemType.labelMy} × {l.qty}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatKyat(l.unitPrice)} × {l.qty} = {formatKyat(l.qty * l.unitPrice)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="rounded-lg border px-3 py-1 text-xs text-destructive"
                  >
                    {labels.sell.removeLine}
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-base font-bold">
              {labels.sell.grandTotal}: {formatKyat(goodsTotal)}
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
            {error}
          </p>
        )}

        <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setStep("review")}
              className="flex-1 rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white shadow disabled:opacity-50 active:scale-[0.98]"
            >
              {labels.sell.review} →
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ─── STEP 3: Review + payment ─────────────────────────────────────
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32 sm:p-6">
      <button
        type="button"
        onClick={() => setStep("items")}
        className="self-start rounded-lg border px-4 py-2"
      >
        ← {labels.common.back}
      </button>

      <h1 className="text-center text-xl font-bold">{labels.sell.review}</h1>

      <section className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{labels.domain.customer}</p>
        <p className="text-lg font-semibold">{customer?.name}</p>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <ul className="flex flex-col divide-y">
          {cart.map((l, i) => (
            <li key={i} className="flex items-center justify-between py-2">
              <div>
                <p className="text-base font-medium">
                  {l.itemType.emoji} {l.itemType.labelMy}
                </p>
                <p className="text-xs text-muted-foreground">
                  {l.qty} × {formatKyat(l.unitPrice)}
                </p>
              </div>
              <p className="font-semibold">{formatKyat(l.qty * l.unitPrice)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-2">
          <span className="text-base font-semibold">{labels.sell.grandTotal}</span>
          <span className="text-2xl font-bold">{formatKyat(goodsTotal)}</span>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">{labels.sell.paidNow}</p>
        <div className="flex items-center justify-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={goodsTotal}
            value={paid || ""}
            onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className="w-48 rounded-xl border bg-background px-4 py-3 text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-lg text-muted-foreground">{labels.units.kyat}</span>
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {[goodsTotal, Math.round(goodsTotal / 2), 50000, 100000, 500000].map((v) =>
            v > 0 && v <= goodsTotal ? (
              <button
                key={v}
                type="button"
                onClick={() => setPaid(v)}
                className="rounded-lg border bg-card px-3 py-1 text-sm"
              >
                {formatKyat(v)}
              </button>
            ) : null,
          )}
          <button
            type="button"
            onClick={() => setPaid(0)}
            className="rounded-lg border bg-card px-3 py-1 text-sm"
          >
            အကြွေး
          </button>
        </div>
        <div className="mt-3 flex items-center justify-between text-base">
          <span className="text-muted-foreground">{labels.sell.remaining}</span>
          <span className={remaining > 0 ? "font-semibold text-rose-600" : ""}>
            {formatKyat(remaining)}
          </span>
        </div>
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || cart.length === 0}
            className="flex-1 rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white shadow disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? labels.common.saving : labels.sell.submit}
          </button>
        </div>
      </div>
    </main>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="self-start rounded-lg border px-4 py-2">
      ← {labels.common.back}
    </Link>
  );
}
