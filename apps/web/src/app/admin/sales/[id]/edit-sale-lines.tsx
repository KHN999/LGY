"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type SaleDetail } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { Button } from "@/components/ui";

/**
 * Admin-only inline editor to correct a sale's prices: a unit price per line plus
 * the discount. Quantities (and stock) are untouched — totals and the customer's
 * balance recompute on save. Hidden for voided sales.
 */
export function EditSaleLines({ sale }: { sale: SaleDetail }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [prices, setPrices] = useState<Record<number, string>>(() =>
    Object.fromEntries(sale.lines.map((l) => [l.id, String(l.unitPrice)])),
  );
  const [discount, setDiscount] = useState(String(sale.discount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toNum = (s: string) => Math.max(0, Math.round(Number(s) || 0));
  const goodsTotal = sale.lines.reduce(
    (sum, l) => sum + toNum(prices[l.id] ?? String(l.unitPrice)) * l.qty,
    0,
  );
  const disc = Math.min(toNum(discount), goodsTotal);
  const grandTotal = goodsTotal - disc;
  const remaining = grandTotal - sale.paidAmount;

  function close() {
    setOpen(false);
    setPrices(Object.fromEntries(sale.lines.map((l) => [l.id, String(l.unitPrice)])));
    setDiscount(String(sale.discount));
    setError(null);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/sales/${sale.id}/lines`, {
        lines: sale.lines.map((l) => ({
          id: l.id,
          unitPrice: toNum(prices[l.id] ?? String(l.unitPrice)),
        })),
        discount: disc,
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

  return (
    <section className="rounded-2xl border border-primary/40 bg-card p-4">
      <h2 className="text-sm font-semibold">{labels.salesAdmin.editPrices}</h2>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">{labels.salesAdmin.editPricesHelp}</p>

      <ul className="flex flex-col divide-y">
        {sale.lines.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-2">
            <span className="min-w-0 flex-1 text-sm">
              {l.itemType?.emoji ?? "🧾"} {l.itemType?.labelMy ?? l.itemName} × {l.qty}
            </span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={prices[l.id] ?? ""}
                onChange={(e) => setPrices((p) => ({ ...p, [l.id]: e.target.value }))}
                className="w-28 rounded-lg border bg-background px-3 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">{labels.units.kyat}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">{labels.domain.discount}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="w-28 rounded-lg border bg-background px-3 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 focus:ring-ring"
          />
          <span className="text-xs text-muted-foreground">{labels.units.kyat}</span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between border-t pt-2">
        <span className="font-semibold">{labels.domain.grandTotal}</span>
        <span className="text-lg font-bold tabular-nums">{formatKyat(grandTotal)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{labels.domain.paid}</span>
        <span className="tabular-nums">{formatKyat(sale.paidAmount)}</span>
      </div>
      {remaining > 0 && (
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{labels.domain.remaining}</span>
          <span className="tabular-nums text-rose-600">{formatKyat(remaining)}</span>
        </div>
      )}
      {remaining < 0 && (
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{labels.salesAdmin.credit}</span>
          <span className="tabular-nums text-emerald-600">{formatKyat(-remaining)}</span>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      <div className="mt-3 flex gap-2">
        <Button type="button" onClick={save} disabled={busy}>
          {busy ? labels.common.saving : labels.common.save}
        </Button>
        <Button type="button" variant="outline" onClick={close} disabled={busy}>
          {labels.common.cancel}
        </Button>
      </div>
    </section>
  );
}
