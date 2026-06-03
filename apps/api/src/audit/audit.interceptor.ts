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
    const payload = sanitize(req.body) as Prisma.InputJsonValue;
    // Login etc. are unguarded, so req.user is unset — keep the attempted username.
    const bodyUsername =
      req.body && typeof (req.body as { username?: unknown }).username === "string"
        ? (req.body as { username: string }).username
        : null;
    const res = context.switchToHttp().getResponse<Response>();

    const write = (status: number, ok: boolean, error: string | null) => {
      const user = req.user;
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
            summary: `${req.method} ${path}`,
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
        );
    };

    return next.handle().pipe(
      tap(() => write(res.statusCode ?? 200, true, null)),
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
}
