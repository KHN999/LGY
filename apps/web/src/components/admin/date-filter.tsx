"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { labels } from "@/lib/labels";

type Preset = "today" | "week" | "month" | "all" | "custom";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function ymdLocal(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA"); // YYYY-MM-DD in local time
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
  const active = (sp.get("range") as Preset) ?? "all";

  function apply(range: Preset, from?: Date, to?: Date) {
    const params = new URLSearchParams(sp.toString());
    params.delete("from");
    params.delete("to");
    params.delete("range");
    if (range !== "all") {
      params.set("range", range);
      if (from) params.set("from", from.toISOString());
      if (to) params.set("to", to.toISOString());
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function preset(p: "today" | "week" | "month" | "all") {
    const now = new Date();
    if (p === "today") apply("today", startOfDay(now), endOfDay(now));
    else if (p === "week")
      apply("week", startOfDay(new Date(now.getTime() - 6 * 86400000)), endOfDay(now));
    else if (p === "month")
      apply("month", new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now));
    else apply("all");
  }

  function setCustom(which: "from" | "to", value: string) {
    if (!value) return;
    const fromIso = sp.get("from");
    const toIso = sp.get("to");
    const from =
      which === "from"
        ? new Date(`${value}T00:00:00`)
        : fromIso
          ? new Date(fromIso)
          : startOfDay(new Date());
    const to =
      which === "to"
        ? new Date(`${value}T23:59:59.999`)
        : toIso
          ? new Date(toIso)
          : endOfDay(new Date());
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

  const fromVal = active === "custom" && sp.get("from") ? ymdLocal(sp.get("from")!) : "";
  const toVal = active === "custom" && sp.get("to") ? ymdLocal(sp.get("to")!) : "";

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
