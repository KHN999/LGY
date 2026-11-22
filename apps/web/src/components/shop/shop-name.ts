import type { ShopId, ShopInfo } from "@/lib/api-client";
import { labels } from "@/lib/labels";

/** Display name for a shop: the two built-in ones use translated labels, the
 *  rest use the name they were given when created. */
export function shopName(key: ShopId, shops?: ShopInfo[]): string {
  if (key === "main") return labels.shop.main;
  if (key === "playground") return labels.shop.test;
  return shops?.find((s) => s.key === key)?.name ?? key;
}

/** Shops known when the list couldn't be fetched: just the built-in pair. */
export const FALLBACK_SHOPS: ShopInfo[] = [
  { key: "main", name: "Main", sandbox: false },
  { key: "playground", name: "Test", sandbox: true },
];
