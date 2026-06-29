import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@lgy/db";
import { getActiveShop, schemaForShop, type ShopId } from "./shop-context";

function urlForShop(shop: ShopId): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  const url = new URL(base);
  url.searchParams.set("schema", schemaForShop(shop));
  return url.toString();
}

// Members that belong to PrismaService itself and must NOT be forwarded to a
// Prisma client. Everything else (model delegates, $transaction, $queryRaw, …)
// is routed to the active shop's client.
const OWN_KEYS = new Set([
  "main",
  "playground",
  "otherShopClients",
  "onModuleInit",
  "onModuleDestroy",
]);

// Interactive-transaction defaults. Prisma's stock 5s timeout is too tight for
// multi-step writes (a sale touches ~12-15 rows) once any per-query latency is
// in play — the sale-creation transaction was timing out (P2028) and failing.
// Generous values here are a safety net for every $transaction in the app; with
// a fast DB connection transactions still finish in well under this.
const TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 20_000 };

/**
 * One Prisma client per shop, fronted by a Proxy that transparently routes
 * every access to the active shop's client. This lets all existing services
 * keep calling `this.prisma.sale…` unchanged while the data space follows the
 * request's selected shop. Auth/user lookups use `.main` to stay canonical.
 *
 * `this` (the super PrismaClient) is the main-schema client; `playground` is
 * the sandbox-schema client.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Always the main (production) schema, regardless of the active shop. */
  readonly main!: PrismaClient;
  private readonly playground: PrismaClient;

  constructor() {
    super({ datasources: { db: { url: urlForShop("main") } }, transactionOptions: TRANSACTION_OPTIONS });
    this.playground = new PrismaClient({
      datasources: { db: { url: urlForShop("playground") } },
      transactionOptions: TRANSACTION_OPTIONS,
    });

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === "string" && OWN_KEYS.has(prop)) {
          if (prop === "main") return target; // the main-schema client (super)
          const own = Reflect.get(target, prop, receiver);
          return typeof own === "function" ? own.bind(target) : own;
        }
        const active = getActiveShop() === "playground" ? target.playground : target;
        const value = Reflect.get(active, prop, active);
        return typeof value === "function" ? value.bind(active) : value;
      },
    });
  }

  /** Every shop client EXCEPT main. Used to mirror canonical (main-schema)
   *  records — e.g. user accounts — into each shop schema so cross-schema FKs
   *  (Sale.createdById, …) hold when operating in that shop. */
  otherShopClients(): PrismaClient[] {
    return [this.playground];
  }

  async onModuleInit() {
    await Promise.all([this.$connect(), this.playground.$connect()]);
  }

  async onModuleDestroy() {
    await Promise.all([this.$disconnect(), this.playground.$disconnect()]);
  }
}
