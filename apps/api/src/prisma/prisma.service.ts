import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@lgy/db";
import { getActiveShop, listShops, MAIN_SHOP, schemaForShop, setShops, type ShopId } from "./shop-context";

/** Connection string for a Postgres schema. Shops created from the app get a
 *  small pool each so many shops can't exhaust the database's connections. */
export function urlForSchema(schema: string, connectionLimit?: number): string {
  const base = process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  const url = new URL(base);
  url.searchParams.set("schema", schema);
  if (connectionLimit) url.searchParams.set("connection_limit", String(connectionLimit));
  return url.toString();
}

// Members that belong to PrismaService itself and must NOT be forwarded to a
// Prisma client. Everything else (model delegates, $transaction, $queryRaw, …)
// is routed to the active shop's client.
const OWN_KEYS = new Set([
  "main",
  "clients",
  "log",
  "clientFor",
  "otherShopClients",
  "clientForShop",
  "reloadShops",
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
 * `this` (the super PrismaClient) is the main-schema client; every other shop's
 * client is created the first time that shop is used.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  /** Always the main (public) schema, regardless of the active shop. */
  readonly main!: PrismaClient;
  private readonly clients = new Map<ShopId, PrismaClient>();
  private readonly log = new Logger("PrismaService");

  constructor() {
    super({ datasources: { db: { url: urlForSchema("public") } }, transactionOptions: TRANSACTION_OPTIONS });

    return new Proxy(this, {
      get: (target, prop, receiver) => {
        if (typeof prop === "string" && OWN_KEYS.has(prop)) {
          if (prop === "main") return target; // the main-schema client (super)
          const own = Reflect.get(target, prop, receiver);
          return typeof own === "function" ? own.bind(target) : own;
        }
        const active = target.clientFor(getActiveShop());
        const value = Reflect.get(active, prop, active);
        return typeof value === "function" ? value.bind(active) : value;
      },
    });
  }

  /** The client for a shop (main = this). Created on first use and kept. */
  private clientFor(shop: ShopId): PrismaClient {
    if (shop === MAIN_SHOP) return this as unknown as PrismaClient;
    let client = this.clients.get(shop);
    if (!client) {
      // The original sandbox keeps a full pool; app-created shops get a small one.
      const limit = shop === "playground" ? undefined : 5;
      client = new PrismaClient({
        datasources: { db: { url: urlForSchema(schemaForShop(shop), limit) } },
        transactionOptions: TRANSACTION_OPTIONS,
      });
      this.clients.set(shop, client);
    }
    return client;
  }

  /** Every shop client EXCEPT main. Used to mirror canonical (main-schema)
   *  records — e.g. user accounts — into each shop schema so cross-schema FKs
   *  (Sale.createdById, …) hold when operating in that shop. */
  otherShopClients(): PrismaClient[] {
    return listShops()
      .filter((s) => s.key !== MAIN_SHOP)
      .map((s) => this.clientFor(s.key));
  }

  /** The client for a specific shop, regardless of the active (cookie) shop.
   *  Used to read an entity from the shop an audit row belongs to. */
  clientForShop(shop: ShopId): PrismaClient {
    return this.clientFor(shop);
  }

  /** Re-read the shop list from the public schema (after one is created). If the
   *  registry table isn't there yet (code deployed before its migration), keep
   *  the built-in main + playground so the app carries on working. */
  async reloadShops(): Promise<void> {
    try {
      const main = this as unknown as PrismaClient;
      const rows = await main.shop.findMany({ orderBy: { id: "asc" } });
      if (rows.length > 0) {
        setShops(rows.map((r) => ({ key: r.key, name: r.name, schema: r.schema, sandbox: r.sandbox })));
      }
    } catch (e) {
      this.log.warn(`Shop registry not readable, using defaults: ${(e as Error).message}`);
    }
  }

  async onModuleInit() {
    await this.$connect();
    await this.reloadShops();
    // Warm the sandbox as before; other shops connect on first use.
    await this.clientFor("playground").$connect();
  }

  async onModuleDestroy() {
    await Promise.all([this.$disconnect(), ...[...this.clients.values()].map((c) => c.$disconnect())]);
  }
}
