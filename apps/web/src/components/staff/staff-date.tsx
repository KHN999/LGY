"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { labels } from "@/lib/labels";

// Yangon (+06:30) "today", independent of the device timezone.
const YGN_OFFSET_MS = 390 * 60_000;
function todayYmd(): string {
  return new Date(Date.now() + YGN_OFFSET_MS).toISOString().slice(0, 10);
}

interface StaffDateCtx {
  /** Selected Yangon business day (YYYY-MM-DD). */
  ymd: string;
  today: string;
  isToday: boolean;
  setYmd: (ymd: string) => void;
  resetToToday: () => void;
  /**
   * ISO instant to send as a backdate (noon of the selected Yangon day), or
   * `undefined` when the selection is today — then the server stamps "now" (live).
   */
  backdateIso: () => string | undefined;
}

const Ctx = createContext<StaffDateCtx | null>(null);

export function useStaffDate(): StaffDateCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStaffDate must be used within StaffDateProvider");
  return ctx;
}

/**
 * Holds the global "recording date" for staff flows. Lives in the staff layout
 * so the selection survives navigation between sell/receive/transfer. Defaults
 * to today; flows call resetToToday() after each save so a backdate never
 * silently carries into the next (real) transaction. Any past day is pickable —
 * the server rejects only days that were actually closed (with a clear message).
 */
export function StaffDateProvider({ children }: { children: ReactNode }) {
  const today = todayYmd();
  const [ymd, setYmd] = useState(today);
  const isToday = ymd === today;

  const value = useMemo<StaffDateCtx>(
    () => ({
      ymd,
      today,
      isToday,
      setYmd,
      resetToToday: () => setYmd(today),
      backdateIso: () =>
        ymd === today ? undefined : new Date(`${ymd}T12:00:00.000+06:30`).toISOString(),
    }),
    [ymd, today, isToday],
  );

  return (
    <Ctx.Provider value={value}>
      {!isToday && (
        <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm font-bold text-amber-950">
          <span>⚠ {labels.backdate.recordingFor}: {ymd}</span>
          <button
            type="button"
            onClick={() => setYmd(today)}
            className="rounded-lg bg-amber-950/15 px-3 py-1 font-bold"
          >
            {labels.backdate.backToToday}
          </button>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

/** The date selector for the staff home page. */
export function StaffDatePicker() {
  const { ymd, today, isToday, setYmd, resetToToday } = useStaffDate();
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2">
      <span className="text-sm text-muted-foreground">{labels.backdate.date}</span>
      <input
        type="date"
        value={ymd}
        max={today}
        onChange={(e) => e.target.value && setYmd(e.target.value)}
        className={
          "rounded-lg border bg-background px-3 py-2 text-base tabular-nums " +
          (isToday ? "" : "border-amber-500 ring-1 ring-amber-500")
        }
      />
      {!isToday && (
        <button
          type="button"
          onClick={resetToToday}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          {labels.backdate.today}
        </button>
      )}
    </div>
  );
}
