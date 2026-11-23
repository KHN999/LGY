"use client";

import { useRouter } from "next/navigation";
import { labels } from "@/lib/labels";

const YGN_OFFSET_MS = 390 * 60_000;
const ymdOf = (d: Date) => new Date(d.getTime() + YGN_OFFSET_MS).toISOString().slice(0, 10);

type Preset = "7" | "30" | "month" | "all";

/**
 * Range picker for the money summary. Unlike the shared DateFilter (which
 * defaults to "today"), this page is about many days at once, so its presets
 * are multi-day and it writes plain Yangon YYYY-MM-DD dates into the URL.
 */
export function MoneyRange({
  from,
  to,
  active,
  firstDay,
}: {
  from: string;
  to: string;
  active: string;
  firstDay: string | null;
}) {
  const router = useRouter();
  const go = (range: string, f: string, t: string) =>
    router.push(`/admin/money?range=${range}&from=${f}&to=${t}`);

  function preset(p: Preset) {
    const now = new Date();
    const today = ymdOf(now);
    if (p === "7") go(p, ymdOf(new Date(now.getTime() - 6 * 86_400_000)), today);
    else if (p === "30") go(p, ymdOf(new Date(now.getTime() - 29 * 86_400_000)), today);
    else if (p === "month") go(p, `${today.slice(0, 8)}01`, today);
    else go(p, firstDay ?? today, today);
  }

  const Btn = ({ p, label }: { p: Preset; label: string }) => (
    <button
      type="button"
      onClick={() => preset(p)}
      className={
        "rounded-lg px-3 py-1.5 text-sm transition " +
        (active === p ? "bg-primary text-primary-foreground" : "border bg-card hover:bg-accent")
      }
    >
      {label}
    </button>
  );
  const inputClass =
    "min-w-0 rounded-lg border bg-background px-2 py-1.5 text-sm " +
    (active === "custom" ? "ring-1 ring-ring" : "");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn p="7" label={labels.moneyBook.last7} />
      <Btn p="30" label={labels.moneyBook.last30} />
      <Btn p="month" label={labels.moneyBook.thisMonth} />
      <Btn p="all" label={labels.moneyBook.all} />
      <span className="mx-1 hidden text-muted-foreground sm:inline">·</span>
      <input
        type="date"
        value={from}
        max={to}
        onChange={(e) => e.target.value && go("custom", e.target.value, to)}
        className={inputClass}
      />
      <span className="text-muted-foreground">–</span>
      <input
        type="date"
        value={to}
        min={from}
        onChange={(e) => e.target.value && go("custom", from, e.target.value)}
        className={inputClass}
      />
    </div>
  );
}
