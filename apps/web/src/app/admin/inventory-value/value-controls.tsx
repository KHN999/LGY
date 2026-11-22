"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { labels } from "@/lib/labels";

/** Shift a YYYY-MM-DD by whole days (pure calendar math, no timezone). */
function shiftYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Day picker + print for the stock-value page. `date` is the Yangon day being
 * shown and `today` the current Yangon day (both from the server, so the
 * viewer's device timezone never matters). Picking today clears the param.
 */
export function ValueControls({ date, today }: { date: string; today: string }) {
  const router = useRouter();
  const go = (ymd: string) => {
    if (!ymd || ymd > today) return;
    router.push(ymd === today ? "/admin/inventory-value" : `/admin/inventory-value?date=${ymd}`);
  };
  const btn = "rounded-lg border bg-card px-3 py-2 text-sm font-medium disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <button type="button" className={btn} onClick={() => go(shiftYmd(date, -1))}>
        ← {labels.admin.valuePrevDay}
      </button>
      <input
        id="value-date"
        type="date"
        aria-label={labels.admin.valueAsOf}
        value={date}
        max={today}
        onChange={(e) => go(e.target.value)}
        className="rounded-lg border bg-background px-3 py-2 text-sm tabular-nums"
      />
      <button
        type="button"
        className={btn}
        disabled={date >= today}
        onClick={() => go(shiftYmd(date, 1))}
      >
        {labels.admin.valueNextDay} →
      </button>
      <button type="button" className={btn} disabled={date === today} onClick={() => go(today)}>
        {labels.common.today}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="ml-auto rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
      >
        🖨 {labels.common.print}
      </button>
    </div>
  );
}

/** Renders its children into the body-level #print-document slot — the only
 *  thing the print stylesheet keeps (see globals.css). */
export function PrintDocument({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(
    <div id="print-document" className="hidden print:block">
      {children}
    </div>,
    document.body,
  );
}
