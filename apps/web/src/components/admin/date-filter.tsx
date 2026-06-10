"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { labels } from "@/lib/labels";

type Preset = "today" | "week" | "month" | "all" | "custom";

// All boundaries are anchored to Yangon time (+06:30), NOT the viewer's browser
// timezone, so the filter is correct from anywhere and lines up with how the
// backend stores day-anchored data (e.g. daily closes at Yangon midnight).
const YGN = "+06:30";
const YGN_OFFSET_MS = 390 * 60_000;

/** YYYY-MM-DD in Yangon for a given instant. */
function yangonYmd(d: Date) {
  return new Date(d.getTime() + YGN_OFFSET_MS).toISOString().slice(0, 10);
}
/** Yangon 00:00:00 of the given YYYY-MM-DD, as an instant. */
function yangonStart(ymd: string) {
  return new Date(`${ymd}T00:00:00.000${YGN}`);
}
/** Yangon 23:59:59.999 of the given YYYY-MM-DD, as an instant. */
function yangonEnd(ymd: string) {
  return new Date(`${ymd}T23:59:59.999${YGN}`);
}

/**
 * Daily / weekly / monthly (+ custom) date filter. Writes `from`/`to` (ISO) and
 * `range` into the URL; the server page reads them and queries the API. Other
 * existing query params (e.g. a status filter) are preserved.
 */
export function DateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const active = (sp.get("range") as Preset) ?? "today";

  function apply(range: Preset, from?: Date, to?: Date, replace = false) {
    const params = new URLSearchParams(sp.toString());
    params.delete("from");
    params.delete("to");
    // Always keep an explicit range marker — including range=all — so the
    // "default to today" effect below only fires on a truly fresh URL (and
    // choosing "All" doesn't get bounced back to today).
    params.set("range", range);
    if (range !== "all") {
      if (from) params.set("from", from.toISOString());
      if (to) params.set("to", to.toISOString());
    }
    const url = `${pathname}?${params.toString()}`;
    if (replace) router.replace(url);
    else router.push(url);
  }

  function preset(p: "today" | "week" | "month" | "all", replace = false) {
    const now = new Date();
    const todayYmd = yangonYmd(now);
    if (p === "today") apply("today", yangonStart(todayYmd), yangonEnd(todayYmd), replace);
    else if (p === "week") {
      const weekAgoYmd = yangonYmd(new Date(now.getTime() - 6 * 86_400_000));
      apply("week", yangonStart(weekAgoYmd), yangonEnd(todayYmd), replace);
    } else if (p === "month") {
      const firstOfMonth = `${todayYmd.slice(0, 8)}01`; // YYYY-MM-01
      apply("month", yangonStart(firstOfMonth), yangonEnd(todayYmd), replace);
    } else apply("all", undefined, undefined, replace);
  }

  // Default the filter to Today when a page is opened with no range set, so the
  // dashboard and lists show today by default instead of all-time. Uses replace
  // so it adds no history entry; "All" sets range=all explicitly, so it won't
  // bounce back here.
  useEffect(() => {
    if (!sp.get("range")) preset("today", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setCustom(which: "from" | "to", value: string) {
    if (!value) return;
    const fromIso = sp.get("from");
    const toIso = sp.get("to");
    const todayYmd = yangonYmd(new Date());
    const from =
      which === "from"
        ? yangonStart(value)
        : fromIso
          ? new Date(fromIso)
          : yangonStart(todayYmd);
    const to =
      which === "to"
        ? yangonEnd(value)
        : toIso
          ? new Date(toIso)
          : yangonEnd(todayYmd);
    apply("custom", from, to);
  }

  const Btn = ({ p, label }: { p: "today" | "week" | "month" | "all"; label: string }) => (
    <button
      type="button"
      onClick={() => preset(p)}
      className={
        "rounded-lg px-3 py-1.5 text-sm transition " +
        (active === p
          ? "bg-primary text-primary-foreground"
          : "border bg-card hover:bg-accent")
      }
    >
      {label}
    </button>
  );

  const fromVal = active === "custom" && sp.get("from") ? yangonYmd(new Date(sp.get("from")!)) : "";
  const toVal = active === "custom" && sp.get("to") ? yangonYmd(new Date(sp.get("to")!)) : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn p="today" label={labels.filter.today} />
      <Btn p="week" label={labels.filter.week} />
      <Btn p="month" label={labels.filter.month} />
      <Btn p="all" label={labels.filter.all} />
      <span className="mx-1 hidden text-muted-foreground sm:inline">·</span>
      <input
        type="date"
        value={fromVal}
        onChange={(e) => setCustom("from", e.target.value)}
        className={
          "rounded-lg border bg-background px-2 py-1.5 text-sm " +
          (active === "custom" ? "ring-1 ring-ring" : "")
        }
      />
      <span className="text-muted-foreground">–</span>
      <input
        type="date"
        value={toVal}
        onChange={(e) => setCustom("to", e.target.value)}
        className={
          "rounded-lg border bg-background px-2 py-1.5 text-sm " +
          (active === "custom" ? "ring-1 ring-ring" : "")
        }
      />
    </div>
  );
}
