/**
 * Active UI dictionary, chosen by NEXT_PUBLIC_LOCALE.
 *
 *   - Development:  NEXT_PUBLIC_LOCALE=en  → English (the source language in code)
 *   - Production:   unset / "my"           → Burmese (labels.my.ts)
 *
 * English is the source of truth (labels.en.ts). Burmese (labels.my.ts) is a
 * partial dictionary: any key not yet translated falls back to its English value,
 * so the app never shows a blank/missing string. Translate Burmese manually over time.
 *
 * Call sites are unchanged: `import { labels } from "@/lib/labels"; labels.sell.submit`.
 */
import { en, type Labels } from "./labels.en";
import { my } from "./labels.my";

export type { Labels };

type AnyObj = Record<string, unknown>;

function isPlainObject(v: unknown): v is AnyObj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Overlay `override` on top of `base`, recursing into plain objects only.
 *  Strings, arrays and functions are treated as leaves (override wins if present). */
function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(override)) return base;
  const out: AnyObj = { ...(base as AnyObj) };
  for (const key of Object.keys(override)) {
    const o = override[key];
    if (o === undefined) continue;
    out[key] = isPlainObject(o) ? deepMerge(out[key], o) : o;
  }
  return out as T;
}

const locale = process.env.NEXT_PUBLIC_LOCALE ?? "my";

export const labels: Labels = locale === "en" ? en : deepMerge(en, my);
