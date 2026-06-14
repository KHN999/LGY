"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SaleDetail, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { Button } from "@/components/ui";

type Draft = {
  key: string;
  itemTypeId: number | null; // null = ad-hoc / custom (free-text) line
  itemName: string;
  qty: string;
  unitPrice: string;
};

const CUSTOM = "__custom__";

/**
 * Admin-only full editor for a posted sale: change items, quantities, prices,
 * discount, and how much was paid; add or remove lines. Stock is rebuilt and the
 * customer balance recomputes on save. Hidden for voided sales.
 */
export function EditSaleLines({ sale, itemTypes }: { sale: SaleDetail; itemTypes: ItemType[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const counter = useRef(0);

  const fromSale = (): Draft[] =>
    sale.lines.map((l) => ({
      key: `L${l.id}`,
      itemTypeId: l.itemTypeId,
      itemName: l.itemName ?? "",
      qty: String(l.qty),
      unitPrice: String(l.unitPrice),
    }));

  const [lines, setLines] = useState<Draft[]>(fromSale);
  const [discount, setDiscount] = useState(String(sale.discount));
  const [paid, setPaid] = useState(String(sale.paidAmount));
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">(
    sale.payments.at(-1)?.method === "BANK_TRANSFER" ? "BANK_TRANSFER" : "CASH",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNum = (s: string) => Math.max(0, Math.round(Number(s) || 0));
  const goodsTotal = lines.reduce((s, l) => s + toNum(l.qty) * toNum(l.unitPrice), 0);
  const disc = Math.min(toNum(discount), goodsTotal);
  const grandTotal = goodsTotal - disc;
  const paidNum = toNum(paid);
  const remaining = grandTotal - paidNum;
  const paidChanged = paidNum !== sale.paidAmount;

  const lineInvalid = (l: Draft) =>
    (l.itemTypeId === null && !l.itemName.trim()) || toNum(l.qty) < 1;
  const invalid = lines.length === 0 || lines.some(lineInvalid);

  function update(key: string, patch: Partial<Draft>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }
  function add() {
    setLines((prev) => [
      ...prev,
      {
        key: `new-${counter.current++}`,
        itemTypeId: itemTypes[0]?.id ?? null,
        itemName: "",
        qty: "1",
        unitPrice: "0",
      },
    ]);
  }
  function close() {
    setOpen(false);
    setLines(fromSale());
    setDiscount(String(sale.discount));
    setPaid(String(sale.paidAmount));
    setError(null);
  }

  async function save() {
    if (invalid) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/sales/${sale.id}/lines`, {
        lines: lines.map((l) =>
          l.itemTypeId !== null
            ? { itemTypeId: l.itemTypeId, qty: toNum(l.qty), unitPrice: toNum(l.unitPrice) }
            : { itemName: l.itemName.trim(), qty: toNum(l.qty), unitPrice: toNum(l.unitPrice) },
        ),
        discount: disc,
        paidAmount: paidNum,
        paymentMethod: method,
      });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (sale.voidedAt) return null;

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setOpen(true)}
      >
        ✏️ {labels.salesAdmin.editPrices}
      </Button>
    );
  }

  const inputCls =
    "rounded-lg border bg-background px-2 py-1.5 text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring";

  return (
    <section className="rounded-2xl border border-primary/40 bg-card p-4">
      <h2 className="text-sm font-semibold">{labels.salesAdmin.editPrices}</h2>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">{labels.salesAdmin.editPricesHelp}</p>

      <ul className="flex flex-col gap-3">
        {lines.map((l) => (
          <li key={l.key} className="rounded-xl border bg-background/40 p-2">
            <div className="flex items-center gap-2">
              <select
                value={l.itemTypeId === null ? CUSTOM : String(l.itemTypeId)}
                onChange={(e) =>
                  update(l.key, {
                    itemTypeId: e.target.value === CUSTOM ? null : Number(e.target.value),
                  })
                }
                className={inputCls + " min-w-0 flex-1"}
              >
                {itemTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji ? t.emoji + " " : ""}
                    {t.labelMy}
                  </option>
                ))}
                <option value={CUSTOM}>✎ {labels.salesAdmin.customItem}</option>
              </select>
              <button
                type="button"
                onClick={() => remove(l.key)}
                className="shrink-0 rounded-lg border px-2 py-1.5 text-sm text-destructive hover:bg-destructive/10"
                aria-label={labels.common.delete}
              >
                🗑
              </button>
            </div>
            {l.itemTypeId === null && (
              <input
                value={l.itemName}
                onChange={(e) => update(l.key, { itemName: e.target.value })}
                placeholder={labels.salesAdmin.customItem}
                maxLength={100}
                className={inputCls + " mt-2 w-full"}
              />
            )}
            <div className="mt-2 flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                {labels.domain.quantity}
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={l.qty}
                  onChange={(e) => update(l.key, { qty: e.target.value })}
                  className={inputCls + " w-16 text-right"}
                />
              </label>
              <span className="text-muted-foreground">×</span>
              <label className="flex flex-1 items-center justify-end gap-1 text-xs text-muted-foreground">
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={l.unitPrice}
                  onChange={(e) => update(l.key, { unitPrice: e.target.value })}
                  className={inputCls + " w-28 text-right"}
                />
                {labels.units.kyat}
              </label>
              <span className="w-28 shrink-0 text-right text-sm font-medium tabular-nums">
                {formatKyat(toNum(l.qty) * toNum(l.unitPrice))}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={add}
        className="mt-3 self-start rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary"
      >
        + {labels.salesAdmin.addItem}
      </button>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">{labels.domain.discount}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className={inputCls + " w-28 text-right"}
          />
          <span className="text-xs text-muted-foreground">{labels.units.kyat}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <span className="font-semibold">{labels.domain.grandTotal}</span>
        <span className="text-lg font-bold tabular-nums">{formatKyat(grandTotal)}</span>
      </div>

      {/* Paid amount */}
      <div className="mt-3 flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{labels.domain.paid}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            className={inputCls + " w-28 text-right"}
          />
          <span className="text-xs text-muted-foreground">{labels.units.kyat}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setPaid(String(grandTotal))}
          className="rounded-lg border bg-card px-3 py-1 text-xs"
        >
          {labels.salesAdmin.fullyPaid}
        </button>
        <button
          type="button"
          onClick={() => setPaid("0")}
          className="rounded-lg border bg-card px-3 py-1 text-xs"
        >
          {labels.sell.asCredit}
        </button>
      </div>

      {/* Method only matters when the paid amount changes to a new positive value */}
      {paidChanged && paidNum > 0 && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["CASH", "BANK_TRANSFER"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={
                "rounded-lg border py-2 text-sm font-semibold transition " +
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
      )}

      {remaining > 0 && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{labels.domain.remaining}</span>
          <span className="tabular-nums text-rose-600">{formatKyat(remaining)}</span>
        </div>
      )}
      {remaining < 0 && (
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{labels.salesAdmin.credit}</span>
          <span className="tabular-nums text-emerald-600">{formatKyat(-remaining)}</span>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={save} disabled={busy || invalid}>
          {busy ? labels.common.saving : labels.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={close} disabled={busy}>
          {labels.common.cancel}
        </Button>
      </div>
    </section>
  );
}
