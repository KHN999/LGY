"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { labels } from "@/lib/labels";

const YGN_OFFSET_MS = 390 * 60_000;
const todayYmd = () => new Date(Date.now() + YGN_OFFSET_MS).toISOString().slice(0, 10);

/** Filter the staff sale history to a single Yangon day (or All). */
export function SalesDateFilter() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const date = sp.get("date") ?? "";

  function set(d: string) {
    const params = new URLSearchParams(sp.toString());
    if (d) params.set("date", d);
    else params.delete("date");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">{labels.backdate.date}</span>
      <input
        type="date"
        value={date}
        max={todayYmd()}
        onChange={(e) => set(e.target.value)}
        className="rounded-lg border bg-background px-3 py-2 text-base tabular-nums"
      />
      {date && (
        <button
          type="button"
          onClick={() => set("")}
          className="rounded-lg border px-3 py-2 text-sm font-medium"
        >
          {labels.filter.all}
        </button>
      )}
    </div>
  );
}
