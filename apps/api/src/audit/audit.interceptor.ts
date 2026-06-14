import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError, tap } from "rxjs/operators";
import { Prisma } from "@lgy/db";
import type { Request, Response } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { SHOP_COOKIE } from "../prisma/shop-context";
import type { AuthenticatedUser } from "../auth/jwt-payload";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Keys whose values must never be persisted (financial-safety + secrets).
const REDACT = /pass|token|secret|cookie|authorization|otp|\bpin\b/i;
const MAX_STR = 500; // truncate long strings (base64 images, etc.)
const MAX_ARRAY = 50;

/** Strip secrets and cap size so the audit row stays small and safe. */
function sanitize(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") {
    return value.length > MAX_STR ? `[${value.length} chars omitted]` : value;
  }
  if (typeof value !== "object") return value;
  if (depth >= 6) return "[…]";
  if (Array.isArray(value)) return value.slice(0, MAX_ARRAY).map((v) => sanitize(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT.test(k) ? "[redacted]" : sanitize(v, depth + 1);
  }
  return out;
}

function deriveEntity(path: string, params: Record<string, string>) {
  const segs = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const entity = segs[0] ?? null;
  const entityId =
    params.id ??
    params.saleId ??
    params.customerId ??
    params.supplierId ??
    params.tailorId ??
    params.orderId ??
    (segs[1] && /^\d+$/.test(segs[1]) ? segs[1] : null) ??
    null;
  return { entity, entityId };
}

const ENTITY_NOUN: Record<string, string> = {
  sales: "Sale",
  "customer-payments": "Customer payment",
  "supplier-payments": "Supplier payment",
  "tailor-payments": "Tailor payment",
  transfers: "Transfer",
  adjustments: "Stock count",
  "opening-stock": "Opening stock",
  expenses: "Expense",
  returns: "Sale return",
  "daily-close": "Daily close",
  "supplier-orders": "Supplier order",
  customers: "Customer",
  suppliers: "Supplier",
  tailors: "Tailor",
  drivers: "Driver",
  employees: "Employee",
  "item-types": "Item type",
  users: "User",
  settings: "Settings",
  "stock-exceptions": "Stock exception",
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const hasNum = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);
const ks = (v: unknown): string => `${num(v).toLocaleString("en-US")} Ks`;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Turn a mutating request into a human, business-readable line for the activity
 * feed — "Sale · 25×500 = 12,500 Ks · walk-in", "Received payment 50,000 Ks
 * (cash)" — rather than a raw "POST /api/sales". Derived from the request body, so
 * no extra DB lookups; falls back to a friendly entity/verb for anything unmapped.
 */
function summarize(method: string, path: string, params: Record<string, string>, rawBody: unknown): string {
  const segs = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const entity = segs[0] ?? "";
  const sub = segs[2];
  const id =
    params.id ?? params.saleId ?? params.orderId ?? params.returnId ??
    (segs[1] && /^\d+$/.test(segs[1]) ? segs[1] : undefined);
  const b = (rawBody && typeof rawBody === "object" ? rawBody : {}) as Record<string, unknown>;
  const noun = ENTITY_NOUN[entity] ?? entity;
  const items = Array.isArray(b.items) ? (b.items as Array<Record<string, unknown>>) : [];

  if (entity === "auth") {
    if (path.endsWith("/login")) return "Signed in";
    if (path.endsWith("/logout")) return "Signed out";
    if (path.includes("password")) return "Changed password";
    return "Auth action";
  }
  if (entity === "shop" && method === "POST") {
    return `Switched to ${b.shop === "playground" ? "Test" : "Main"} shop`;
  }
  if (sub === "void" || sub === "cancel") return `Deleted ${noun.toLowerCase()} #${id}`;
  if (entity === "sales" && sub === "lines") {
    return `Edited prices on sale #${id}${hasNum(b.discount) ? ` · discount ${ks(b.discount)}` : ""}`;
  }
  if (entity === "sales" && sub === "payments") return `Payment ${ks(b.amount)} on sale #${id}`;
  if (entity === "sales" && method === "POST" && !sub) {
    const total = items.reduce((s, i) => s + num(i.qty) * num(i.unitPrice), 0) - num(b.discount);
    const who = str(b.customerName) ?? (b.customerId ? `customer #${String(b.customerId)}` : "walk-in");
    if (items.length === 1) {
      return `Sale · ${num(items[0].qty)}×${num(items[0].unitPrice).toLocaleString("en-US")} = ${total.toLocaleString("en-US")} Ks · ${who}`;
    }
    return `Sale · ${items.length} items = ${total.toLocaleString("en-US")} Ks · ${who}`;
  }
  if (entity === "customer-payments" && method === "POST") {
    const m = str(b.method);
    return `Received payment ${ks(b.amount)}${m ? ` (${m.toLowerCase().replace(/_/g, " ")})` : ""}`;
  }
  if (entity === "supplier-payments" && method === "POST") return `Paid supplier ${ks(b.amount)}`;
  if (entity === "expenses" && method === "POST") return `Expense ${ks(b.amount)}`;
  if (entity === "transfers" && method === "POST") {
    const qty = items.length ? items.reduce((s, i) => s + num(i.qty), 0) : num(b.qty);
    return `Transfer ${qty} pcs · ${String(b.fromLocation ?? "?")} → ${String(b.toLocation ?? "?")}`;
  }
  if (entity === "adjustments" && method === "POST") {
    const n = Array.isArray(b.counts) ? (b.counts as unknown[]).length : 1;
    return `Stock count · ${n} item${n === 1 ? "" : "s"}`;
  }
  if (entity === "returns" && method === "POST") {
    return `Return on sale #${String(b.saleId ?? id ?? "")}${hasNum(b.refundAmount) ? ` · refund ${ks(b.refundAmount)}` : ""}`;
  }
  if (entity === "daily-close" && method === "POST") return `Daily close · counted ${ks(b.countedCash)}`;
  if (entity === "opening-stock" && method === "POST") return "Opening stock set";

  if (method === "POST" && !id) return `New ${noun.toLowerCase()}${str(b.name) ? `: ${str(b.name)}` : ""}`;
  if (method === "POST") return `${noun} #${id}${sub ? ` · ${sub}` : ""}`;
  // A roll order is "deleted" by patching its status to CANCELLED — log it as a
  // deletion, not a generic update.
  if (
    entity === "supplier-orders" &&
    (method === "PATCH" || method === "PUT") &&
    str(b.status) === "CANCELLED"
  ) {
    return `Deleted roll order${id ? ` #${id}` : ""}`;
  }
  if (method === "PATCH" || method === "PUT") return `Updated ${noun.toLowerCase()}${id ? ` #${id}` : ""}`;
  if (method === "DELETE") return `Deleted ${noun.toLowerCase()}${id ? ` #${id}` : ""}`;
  return `${noun} · ${method}`;
}

/**
 * Richer summary built from the RESPONSE of inventory actions. The request body
 * only carries target counts; the response is the resulting event with the actual
 * per-item lines (signed delta + item name) — e.g. "Stock count: မိုက်လျှော −5,
 * ဝမ်းဆက် +20". Returns null for anything else (caller falls back to the body
 * summary, which already covers sales/payments/transfers/etc.).
 */
function summarizeFromResponse(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  // Customer merge (POST /customers/:id/merge) → survivor + { mergedCount, mergedNames }.
  if (typeof d.mergedCount === "number" && typeof d.name === "string") {
    const names = Array.isArray(d.mergedNames) ? (d.mergedNames as unknown[]).join(", ") : "";
    return `Merged ${d.mergedCount} customer(s)${names ? ` (${names})` : ""} into ${d.name}`;
  }
  // Customer write-off (DELETE /customers/:id) → { id, name, clearedDebt }.
  if (d.id != null && typeof d.name === "string" && typeof d.clearedDebt === "number") {
    return d.clearedDebt > 0
      ? `Deleted customer ${d.name} — debt ${ks(d.clearedDebt)} cleared`
      : `Deleted customer ${d.name}`;
  }
  if (d.kind !== "ADJUSTMENT" && d.kind !== "OPENING_STOCK") return null;
  const lines = Array.isArray(d.lines) ? (d.lines as Array<Record<string, unknown>>) : [];
  if (lines.length === 0) return null;
  const verb = d.kind === "ADJUSTMENT" ? "Stock count" : "Opening stock";
  const parts = lines.slice(0, 8).map((l) => {
    const it = l.itemType as Record<string, unknown> | undefined;
    const name =
      (typeof it?.labelMy === "string" && it.labelMy) ||
      (typeof it?.key === "string" && it.key) ||
      `item#${String(l.itemTypeId)}`;
    return `${name} ${l.direction === "OUT" ? "−" : "+"}${num(l.qty)}`;
  });
  return `${verb}: ${parts.join(", ")}${lines.length > 8 ? ` +${lines.length - 8} more` : ""}`;
}

type ReqWithUser = Request & {
  user?: AuthenticatedUser;
  cookies?: Record<string, string>;
};

/**
 * System-wide audit trail. One row per mutating request (POST/PATCH/PUT/DELETE)
 * from staff or admin, written NON-BLOCKING after the handler resolves — so it
 * never adds latency to the hot path (Railway DB round-trips are ~0.3s). Lives at
 * the HTTP layer on purpose: it captures the actor + outcome (incl. failures)
 * regardless of whether the handler used Prisma or raw SQL. Always written via the
 * MAIN client so the whole audit log sits in one schema, tagged with the shop.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger("Audit");
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle();
    const req = context.switchToHttp().getRequest<ReqWithUser>();
    if (!MUTATING.has(req.method)) return next.handle();

    const start = Date.now();
    const path = (req.originalUrl || req.url || "").split("?")[0];
    const shop = req.cookies?.[SHOP_COOKIE] === "playground" ? "playground" : "main";
    const fwd = req.headers["x-forwarded-for"];
    const ip =
      (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;
    const params = (req.params ?? {}) as Record<string, string>;
    const { entity, entityId } = deriveEntity(path, params);
    const summary = summarize(req.method, path, params, req.body);
    const payload = sanitize(req.body) as Prisma.InputJsonValue;
    // Login etc. are unguarded, so req.user is unset — keep the attempted username.
    const bodyUsername =
      req.body && typeof (req.body as { username?: unknown }).username === "string"
        ? (req.body as { username: string }).username
        : null;
    const res = context.switchToHttp().getResponse<Response>();
    const sub = path.replace(/^\/api\//, "").split("/").filter(Boolean)[2];
    const bodyObj = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};

    const write = (status: number, ok: boolean, error: string | null, summaryOverride?: string | null) => {
      const user = req.user;
      // Resolve a name-rich summary off the hot path. The inventory response
      // override already carries item names, so it wins; otherwise enrich the
      // body-derived line with item/party names (falling back to the plain one).
      const build = summaryOverride
        ? Promise.resolve(summaryOverride)
        : this.enrich(entity ?? "", sub, entityId, bodyObj, shop, req.method)
            .then((s) => s ?? summary)
            .catch(() => summary);
      void build.then((finalSummary) =>
        this.prisma.main.auditLog
          .create({
            data: {
              userId: user?.sub ?? null,
              username: user?.username ?? bodyUsername,
              shop,
              method: req.method,
              path,
              entity,
              entityId,
              summary: finalSummary,
              status,
              ok,
              error,
              payload,
              ip,
              durationMs: Date.now() - start,
            },
          })
          .catch((e: unknown) =>
            this.logger.error(`audit write failed for ${req.method} ${path}: ${String(e)}`),
          ),
      );
    };

    return next.handle().pipe(
      tap((data) => write(res.statusCode ?? 200, true, null, summarizeFromResponse(data))),
      catchError((err: unknown) => {
        const status =
          typeof (err as { getStatus?: () => number })?.getStatus === "function"
            ? (err as { getStatus: () => number }).getStatus()
            : ((err as { status?: number })?.status ?? 500);
        const raw =
          (err as { response?: { message?: unknown } })?.response?.message ??
          (err as { message?: unknown })?.message ??
          String(err);
        write(status, false, (Array.isArray(raw) ? raw.join(", ") : String(raw)).slice(0, 1000));
        return throwError(() => err);
      }),
    );
  }

  /**
   * Resolve item/party names so the summary reads "Sale · 25 × ဝမ်းဆက် … · Daw Mya"
   * instead of ids. Runs in the non-blocking write path. Item names are resolved
   * for both shops (the catalog is identical); party names only for the real shop
   * (playground ids would resolve to different demo records). Returns null to fall
   * back to the plain body summary.
   */
  private async enrich(
    entity: string,
    sub: string | undefined,
    id: string | null,
    body: Record<string, unknown>,
    shop: string,
    method: string,
  ): Promise<string | null> {
    // Void/cancel actions carry no useful body — let the plain summary ("Deleted
    // <noun> #id") stand instead of mis-reading the empty body as a create.
    if (sub === "void" || sub === "cancel") return null;
    const items = Array.isArray(body.items) ? (body.items as Array<Record<string, unknown>>) : [];
    const itemNames = async (): Promise<Map<number, string>> => {
      const ids = [...new Set(items.map((i) => Number(i.itemTypeId)).filter((n) => Number.isInteger(n)))];
      if (!ids.length) return new Map();
      const types = await this.prisma.main.itemType.findMany({
        where: { id: { in: ids } },
        select: { id: true, labelMy: true },
      });
      return new Map(types.map((t) => [t.id, t.labelMy]));
    };
    const party = async (kind: "customers" | "suppliers", idVal: unknown): Promise<string | null> =>
      shop === "main" && Number.isInteger(Number(idVal)) ? this.lookupName(kind, Number(idVal)) : null;

    if (entity === "sales" && method === "POST" && !sub) {
      const names = await itemNames();
      const total = items.reduce((s, i) => s + num(i.qty) * num(i.unitPrice), 0) - num(body.discount);
      const desc =
        items
          .slice(0, 3)
          .map((i) => {
            const nm = i.itemTypeId != null ? names.get(Number(i.itemTypeId)) : str(i.itemName);
            return `${num(i.qty)}×${nm ?? `item#${String(i.itemTypeId ?? "?")}`}`;
          })
          .join(" + ") + (items.length > 3 ? ` +${items.length - 3} more` : "");
      const who =
        str(body.customerName) ??
        (await party("customers", body.customerId)) ??
        (body.customerId ? `customer #${String(body.customerId)}` : "walk-in");
      return `Sale · ${desc} = ${total.toLocaleString("en-US")} Ks · ${who}`;
    }
    if (entity === "customer-payments" && method === "POST") {
      const who = (await party("customers", body.customerId)) ?? `customer #${String(body.customerId ?? "?")}`;
      const m = str(body.method);
      return `Received ${ks(body.amount)}${m ? ` (${m.toLowerCase().replace(/_/g, " ")})` : ""} from ${who}`;
    }
    if (entity === "supplier-payments" && method === "POST") {
      const who = (await party("suppliers", body.supplierId)) ?? `supplier #${String(body.supplierId ?? "?")}`;
      return `Paid ${who} ${ks(body.amount)}`;
    }
    if (entity === "transfers" && method === "POST") {
      const names = await itemNames();
      const desc =
        items.slice(0, 3).map((i) => `${num(i.qty)}×${names.get(Number(i.itemTypeId)) ?? `item#${String(i.itemTypeId)}`}`).join(" + ") ||
        `${num(body.qty)} pcs`;
      return `Transfer ${desc} · ${String(body.fromLocation ?? "?")} → ${String(body.toLocation ?? "?")}`;
    }
    if (entity === "supplier-orders" && method === "POST") {
      const item =
        (Number.isInteger(Number(body.itemTypeId)) ? await this.lookupName("item-types", Number(body.itemTypeId)) : null) ??
        `item#${String(body.itemTypeId ?? "?")}`;
      const sup = (await party("suppliers", body.supplierId)) ?? `supplier #${String(body.supplierId ?? "?")}`;
      return `Roll order: ${num(body.expectedQty)} × ${item} from ${sup} · ${ks(body.expectedTotal)}`;
    }
    if (entity === "expenses" && method === "POST") {
      const cat =
        shop === "main" && Number.isInteger(Number(body.categoryId))
          ? (await this.prisma.main.expenseCategory.findUnique({ where: { id: Number(body.categoryId) }, select: { labelMy: true } }))?.labelMy ?? null
          : null;
      return cat ? `Expense: ${cat} · ${ks(body.amount)}` : `Expense ${ks(body.amount)}`;
    }
    if (id && (method === "PATCH" || method === "DELETE") && shop === "main") {
      const name = await this.lookupName(entity, Number(id));
      if (name) {
        const noun = (ENTITY_NOUN[entity] ?? entity).toLowerCase();
        return `${method === "DELETE" ? "Deleted" : "Updated"} ${noun}: ${name}`;
      }
    }
    return null;
  }

  private async lookupName(entity: string, id: number): Promise<string | null> {
    if (!Number.isInteger(id)) return null;
    const main = this.prisma.main;
    const sel = { where: { id }, select: { name: true } };
    try {
      switch (entity) {
        case "customers": return (await main.customer.findUnique(sel))?.name ?? null;
        case "suppliers": return (await main.supplier.findUnique(sel))?.name ?? null;
        case "tailors": return (await main.tailor.findUnique(sel))?.name ?? null;
        case "drivers": return (await main.driver.findUnique(sel))?.name ?? null;
        case "employees": return (await main.employee.findUnique(sel))?.name ?? null;
        case "item-types":
          return (await main.itemType.findUnique({ where: { id }, select: { labelMy: true } }))?.labelMy ?? null;
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
