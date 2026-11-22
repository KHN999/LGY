import { AsyncLocalStorage } from "node:async_hooks";

/**
 * "Shops" are isolated data spaces backed by separate Postgres schemas:
 *   - main       → schema `public`
 *   - playground → schema `playground` (the practice sandbox)
 *   - shop_N     → shops created from the admin app, each in its own schema
 *
 * The list lives in the `Shop` table of the public schema and is cached here
 * (loaded at startup, refreshed when a shop is created). The active shop for a
 * request is held in AsyncLocalStorage (set by the shop middleware from the
 * `lgy_shop` cookie); PrismaService reads it to route every query to the right
 * schema, so work done in one shop can never touch another shop's stock,
 * balances or cash close.
 */
export type ShopId = string;

export interface ShopInfo {
  key: ShopId;
  name: string;
  schema: string;
  sandbox: boolean;
}

export const MAIN_SHOP: ShopId = "main";
export const SHOP_COOKIE = "lgy_shop";

// Until the registry is read from the database, the two original shops.
let registry = new Map<ShopId, ShopInfo>([
  ["main", { key: "main", name: "Main", schema: "public", sandbox: false }],
  ["playground", { key: "playground", name: "Test", schema: "playground", sandbox: true }],
]);

/** Replace the cached shop list (called by PrismaService after reading the table). */
export function setShops(list: ShopInfo[]): void {
  if (!list.some((s) => s.key === MAIN_SHOP)) return; // never lose main
  registry = new Map(list.map((s) => [s.key, s]));
}

export function listShops(): ShopInfo[] {
  return [...registry.values()];
}

export function getShop(key: ShopId): ShopInfo | undefined {
  return registry.get(key);
}

export function schemaForShop(shop: ShopId): string {
  return registry.get(shop)?.schema ?? "public";
}

export function isShopId(value: unknown): value is ShopId {
  return typeof value === "string" && registry.has(value);
}

export const shopStorage = new AsyncLocalStorage<ShopId>();

/** The request's active shop, defaulting to `main`. */
export function getActiveShop(): ShopId {
  return shopStorage.getStore() ?? MAIN_SHOP;
}
