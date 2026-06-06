"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ItemType, type SaleDetail } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { ItemTypeGrid } from "@/components/staff/item-type-grid";
import { NumberPad } from "@/components/staff/number-pad";

interface AddLine {
  itemType: ItemType;
  qty: number;
  unitPrice: number;
}

const fieldCx = (active: boolean) =>
  "flex flex-col items-center rounded-xl border-2 py-2 " +
  (active ? "border-emerald-500 bg-emerald-50" : "border-transparent bg-muted");

/**
 * Add-on: append catalog items to a posted sale (the buyer came back for more),
 * keeping it one receipt. Same cash-register entry as the sell flow — pick an
 * item, tap qty then price on the keypad, add. Paid-now defaults to mirror the
 * original sale (cash → full, credit → 0).
 */
export function AddOnFlow({ sale, onClose }: { sale: SaleDetail; onClose: () => void }) {
  const router = useRouter();
  const isWalkIn = sale.customerId == null;
  const originalFullyPaid = sale.status === "PAID";

  const [cart, setCart] = useState<AddLine[]>([]);
  const [draft, setDraft] = useState<{ type: ItemType; qty: number; price: number } | null>(null);
  const [activeField, setActiveField] = useState<"qty" | "price">("qty");
  const [paid, setPaid] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addedTotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const defaultPaid = isWalkIn || originalFullyPaid ? addedTotal : 0;
  const paidNow = paidTouched ? Math.min(paid, addedTotal) : defaultPaid;

  function onDigit(d: number) {
    setDraft((p) =>
      !p
        ? p
        : activeField === "qty"
          ? { ...p, qty: Math.min(999999, p.qty * 10 + d) }
          : { ...p, price: Math.min(99999999, p.price * 10 + d) },
    );
  }
  function onBackspace() {
    setDraft((p) =>
      !p
        ? p
        : activeField === "qty"
          ? { ...p, qty: Math.floor(p.qty / 10) }
          : { ...p, price: Math.floor(p.price / 10) },
    );
  }
  function onClear() {
    setDraft((p) => (p ? (activeField === "qty" ? { ...p, qty: 0 } : { ...p, price: 0 }) : p));
  }
  function addDraft() {
    if (!draft || draft.qty <= 0) return;
    setCart((c) => [...c, { itemType: draft.type, qty: draft.qty, unitPrice: draft.price }]);
    setDraft(null);
  }

  async function submit() {
    if (cart.length === 0) {
      setError(labels.errors.required);
      return;
    }
    if (isWalkIn && paidNow !== addedTotal) {
      setError(labels.addOn.walkInFull);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post(`/sales/${sale.id}/add-items`, {
        items: cart.map((l) => ({ itemTypeId: l.itemType.id, qty: l.qty, unitPrice: l.unitPrice })),
        paidAmount: paidNow,
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Keypad entry for the picked item ──
  if (draft) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-300 bg-card p-4">
        <p className="text-center text-lg font-bold">
          {draft.type.emoji ?? "🧾"} {draft.type.labelMy}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setActiveField("qty")} className={fieldCx(activeField === "qty")}>
            <span className="text-xs text-muted-foreground">{labels.receipt.qty}</span>
            <span className="text-2xl font-bold tabular-nums">{draft.qty || 0}</span>
          </button>
          <button type="button" onClick={() => setActiveField("price")} className={fieldCx(activeField === "price")}>
            <span className="text-xs text-muted-foreground">{labels.receipt.price}</span>
            <span className="text-2xl font-bold tabular-nums">{draft.price || 0}</span>
          </button>
        </div>
        <NumberPad onDigit={onDigit} onBackspace={onBackspace} onClear={onClear} />
        <div className="flex gap-2">
          <button type="button" onClick={() => setDraft(null)} className="rounded-lg border px-4 py-3">
            {labels.common.cancel}
          </button>
          <button
            type="button"
            onClick={addDraft}
            disabled={draft.qty <= 0}
            className="flex-1 rounded-lg bg-emerald-600 py-3 font-bold text-white disabled:opacity-50"
          >
            {labels.addOn.addLine} ({formatKyat(draft.qty * draft.price)})
          </button>
        </div>
      </div>
    );
  }

  // ── Cart + item grid + confirm ──
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-300 bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold">{labels.addOn.title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg border px-3 py-1 text-sm">
          {labels.common.cancel}
        </button>
      </div>

      {cart.length > 0 && (
        <ul className="flex flex-col divide-y">
          {cart.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-2 text-sm">
              <span className="min-w-0 truncate">
                {l.itemType.emoji ?? "🧾"} {l.itemType.labelMy} · {l.qty}×{formatKyat(l.unitPrice)}
              </span>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-semibold tabular-nums">{formatKyat(l.qty * l.unitPrice)}</span>
                <button
                  type="button"
                  onClick={() => setCart((c) => c.filter((_, idx) => idx !== i))}
                  className="text-rose-600"
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm text-muted-foreground">{labels.addOn.pickItem}</p>
      <ItemTypeGrid
        locationForStock="SHOP"
        allowOversell
        sellableOnly
        onPick={(t) => {
          setDraft({ type: t, qty: 0, price: 0 });
          setActiveField("qty");
        }}
      />

      {cart.length > 0 && (
        <>
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>{labels.addOn.addedTotal}</span>
            <span className="tabular-nums">{formatKyat(addedTotal)}</span>
          </div>
          {!isWalkIn && (
            <label className="flex items-center justify-between gap-2 text-sm">
              <span>{labels.addOn.paidNow}</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={addedTotal}
                value={paidNow || ""}
                onChange={(e) => {
                  setPaidTouched(true);
                  setPaid(Math.max(0, Math.min(addedTotal, Number(e.target.value) || 0)));
                }}
                className="w-32 rounded-lg border bg-background px-3 py-2 text-right text-lg tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="rounded-2xl bg-emerald-600 py-4 text-xl font-bold text-white shadow active:scale-[0.98] disabled:opacity-50"
          >
            {submitting ? labels.common.saving : labels.addOn.confirm}
          </button>
        </>
      )}
    </div>
  );
}
