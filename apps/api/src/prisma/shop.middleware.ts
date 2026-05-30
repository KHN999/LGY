import type { NextFunction, Request, Response } from "express";
import { isShopId, SHOP_COOKIE, shopStorage } from "./shop-context";

/**
 * Reads the `lgy_shop` cookie and runs the rest of the request inside the
 * shop's AsyncLocalStorage context, so PrismaService routes every query to the
 * matching schema. Must run after cookie-parser. Defaults to the real `main`
 * shop when the cookie is missing or invalid.
 */
export function shopMiddleware(req: Request, _res: Response, next: NextFunction) {
  const raw = (req as Request & { cookies?: Record<string, string> }).cookies?.[SHOP_COOKIE];
  const shop = isShopId(raw) ? raw : "main";
  shopStorage.run(shop, () => next());
}
