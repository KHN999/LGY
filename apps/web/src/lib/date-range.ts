// Resolve a filtered page's active date range from its search params, on the
// SERVER, defaulting to TODAY (Yangon) when nothing is set. This makes the first
// paint already "today" instead of rendering all-time and then snapping to today
// (the DateFilter's client default). `range=all` means no bounds (all-time).

const YGN = "+06:30";
const YGN_OFFSET_MS = 390 * 60_000;

export function effectiveDateRange(p: {
  from?: string;
  to?: string;
  range?: string;
}): { from?: string; to?: string } {
  if (p.range === "all") return {};
  if (p.from && p.to) return { from: p.from, to: p.to };
  // Default: the current Yangon business day.
  const ymd = new Date(Date.now() + YGN_OFFSET_MS).toISOString().slice(0, 10);
  return {
    from: new Date(`${ymd}T00:00:00.000${YGN}`).toISOString(),
    to: new Date(`${ymd}T23:59:59.999${YGN}`).toISOString(),
  };
}
