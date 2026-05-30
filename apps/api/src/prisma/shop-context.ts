import { AsyncLocalStorage } from "node:async_hooks";

/**
 * "Shops" are isolated data spaces backed by separate Postgres schemas:
 *   - main       → the real production data (schema `public`)
 *   - playground → a sandbox for testing/training (schema `playground`)
 *
 * The active shop for a request is held in AsyncLocalStorage (set by the shop
 * middleware from the `lgy_shop` cookie). PrismaService reads it to route every
 * query to the right schema, so a sale made in the playground can never touch
 * real stock, balances, or the daily cash close.
 */
export type ShopId = "main" | "playground";

export const SHOP_IDS: ShopId[] = ["main", "playground"];
export const SHOP_COOKIE = "lgy_shop";

const SCHEMA: Record<ShopId, string> = {
  main: "public",
  playground: "playground",
};

export function schemaForShop(shop: ShopId): string {
  return SCHEMA[shop];
}

export function isShopId(value: unknown): value is ShopId {
  return value === "main" || value === "playground";
}

export const shopStorage = new AsyncLocalStorage<ShopId>();

/** The request's active shop, defaulting to the real `main` shop. */
export function getActiveShop(): ShopId {
  return shopStorage.getStore() ?? "main";
}
