"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type ItemType, type StockRow } from "@/lib/api-client";
import { labels } from "@/lib/labels";

interface Props {
  /** Pass a location to also show stock-on-hand per item type. */
  locationForStock?: "WAREHOUSE" | "SHOP" | "IN_TRANSIT";
  /** Hide types whose stock is 0 at the given location. */
  hideZeroStock?: boolean;
  onPick: (t: ItemType, stock: number) => void;
  /** Disable types whose stock is below this threshold. */
  minStock?: number;
  /** Allow tapping every item regardless of stock (shop oversell). Still shows
   *  the stock count (red when ≤0), but never hides or disables. */
  allowOversell?: boolean;
  /** Only show item types marked sellable in the shop (hides warehouse-only items). */
  sellableOnly?: boolean;
}

/**
 * Cash-register-style picker: large square buttons with emoji + Burmese label.
 * One tap to choose. Optionally annotates each tile with shop stock count.
 */
export function ItemTypeGrid({
  locationForStock,
  hideZeroStock,
  onPick,
  minStock = 0,
  allowOversell = false,
  sellableOnly = false,
}: Props) {
  const [types, setTypes] = useState<ItemType[]>([]);
  const [stockByItem, setStockByItem] = useState<Map<number, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    Promise.all([
      api.get<ItemType[]>("/item-types", ctrl.signal),
      locationForStock
        ? api.get<StockRow[]>(`/inventory/stock?location=${locationForStock}`, ctrl.signal)
        : Promise.resolve(null),
    ])
      .then(([t, s]) => {
        setTypes(t);
        if (s) {
          const map = new Map<number, number>();
          for (const r of s) map.set(r.itemTypeId, r.qty);
          setStockByItem(map);
        }
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [locationForStock]);

  const visible = useMemo(() => {
    let list = types;
    if (sellableOnly) list = list.filter((t) => t.sellable);
    if (hideZeroStock && !allowOversell) {
      list = list.filter((t) => (stockByItem.get(t.id) ?? 0) > 0);
    }
    return list;
  }, [types, stockByItem, hideZeroStock, allowOversell, sellableOnly]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted" />
        ))}
      </div>
    );
  }
  if (error) {
    return <p className="rounded-lg bg-destructive/10 p-3 text-destructive">{error}</p>;
  }
  if (visible.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-6 text-center text-muted-foreground">
        {labels.common.noData}
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {visible.map((t) => {
        const stock = stockByItem.get(t.id) ?? 0;
        const disabled =
          locationForStock !== undefined && !allowOversell && stock < minStock;
        return (
          <button
            key={t.id}
            type="button"
            disabled={disabled}
            onClick={() => onPick(t, stock)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-card p-3 text-center shadow-sm active:scale-[0.97] disabled:opacity-40"
          >
            {t.emoji && <span className="text-5xl">{t.emoji}</span>}
            <span className="text-lg font-semibold leading-tight">{t.labelMy}</span>
            {locationForStock !== undefined && (
              <span
                className={
                  "mt-0.5 text-xs " +
                  (stock <= 0 ? "text-rose-600 font-semibold" : "text-muted-foreground")
                }
              >
                {labels.sell.inStock}: {stock}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
