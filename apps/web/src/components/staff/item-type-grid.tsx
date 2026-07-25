"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type ItemType, type ShopId, type StockRow } from "@/lib/api-client";
import { labels } from "@/lib/labels";

// Stale-while-revalidate cache. The item catalog is essentially static and shop
// stock changes slowly, so we paint the last-known values instantly and refresh in
// the background — no skeleton, no waiting on slow round-trips. Backed by a module
// cache (instant within a session) AND localStorage (survives full page reloads),
// both scoped to the active shop so Main/Test never bleed.
const cachedTypes: Record<string, ItemType[] | undefined> = {};
const cachedStock: Record<string, Record<string, Map<number, number> | undefined>> = {};

function lsGet<T>(key: string): T | null {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function lsSet(key: string, val: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* quota exceeded / private mode — caching is best-effort */
  }
}
const typesLSKey = (shop: ShopId) => `lgy.types.${shop}`;
const stockLSKey = (shop: ShopId, loc: string) => `lgy.stock.${shop}.${loc}`;

function itemTypeFromStockRow(row: StockRow): ItemType {
  return {
    id: row.itemTypeId,
    key: row.key,
    labelMy: row.labelMy,
    emoji: row.emoji,
    sortOrder: row.sortOrder ?? 0,
    isActive: row.isActive ?? true,
    sellable: row.sellable ?? true,
  };
}

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
  /** Float the item with this exact labelMy to the front (still shows all others).
   *  No-op when nothing matches. Used to default the transfer picker. */
  preferLabel?: string;
  /** Server-known active shop. The cookie is httpOnly, so the browser cannot read it. */
  shopId?: ShopId;
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
  preferLabel,
  shopId = "main",
}: Props) {
  const stockKey = locationForStock ?? "";
  const [types, setTypes] = useState<ItemType[]>(() => cachedTypes[shopId] ?? []);
  const [stockByItem, setStockByItem] = useState<Map<number, number>>(
    () => cachedStock[shopId]?.[stockKey] ?? new Map(),
  );
  // Only the very first load (nothing cached yet) blocks with a skeleton.
  const [loading, setLoading] = useState(() => cachedTypes[shopId] === undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const key = locationForStock ?? "";
    const activeShop = shopId;

    // Cold in-memory cache (e.g. a fresh page load): hydrate instantly from
    // localStorage so the menu paints with no skeleton, then revalidate below.
    if (cachedTypes[activeShop] === undefined) {
      const lsTypes = lsGet<ItemType[]>(typesLSKey(activeShop));
      if (lsTypes && lsTypes.length) {
        cachedTypes[activeShop] = lsTypes;
        setTypes(lsTypes);
        setLoading(false);
      }
      if (locationForStock) {
        const lsStock = lsGet<[number, number][]>(stockLSKey(activeShop, locationForStock));
        if (lsStock) {
          const m = new Map<number, number>(lsStock);
          cachedStock[activeShop] ??= {};
          cachedStock[activeShop][key] = m;
          setStockByItem(m);
        }
      }
    }

    if (cachedTypes[activeShop] === undefined) setLoading(true);
    const load = locationForStock
      ? api
          .get<StockRow[]>(`/inventory/stock?location=${locationForStock}`, ctrl.signal)
          .then((rows) => {
            const t = rows.map(itemTypeFromStockRow);
            const map = new Map<number, number>();
            for (const r of rows) map.set(r.itemTypeId, r.qty);
            return { types: t, stock: map };
          })
      : api
          .get<ItemType[]>("/item-types", ctrl.signal)
          .then((t) => ({ types: t, stock: null }));

    load
      .then(({ types: t, stock }) => {
        cachedTypes[activeShop] = t;
        setTypes(t);
        setError(null);
        lsSet(typesLSKey(activeShop), t);
        if (stock) {
          cachedStock[activeShop] ??= {};
          cachedStock[activeShop][key] = stock;
          setStockByItem(stock);
          if (locationForStock) {
            lsSet(stockLSKey(activeShop, locationForStock), [...stock.entries()]);
          }
        }
      })
      .catch((e: Error) => {
        // Keep showing cached data on a failed background refresh; only surface
        // the error when we have nothing to show.
        if (e.name !== "AbortError" && cachedTypes[activeShop] === undefined) setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [locationForStock, shopId]);

  const visible = useMemo(() => {
    let list = types;
    if (sellableOnly) list = list.filter((t) => t.sellable);
    if (hideZeroStock && !allowOversell) {
      list = list.filter((t) => (stockByItem.get(t.id) ?? 0) > 0);
    }
    // Float the preferred item to the front (stable order otherwise).
    if (preferLabel) {
      const pref = preferLabel.trim();
      list = [...list].sort(
        (a, b) => Number(b.labelMy === pref) - Number(a.labelMy === pref),
      );
    }
    return list;
  }, [types, stockByItem, hideZeroStock, allowOversell, sellableOnly, preferLabel]);

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
