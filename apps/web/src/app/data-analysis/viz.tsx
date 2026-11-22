import type { ReactNode } from "react";

// Chart colours: a validated categorical order (never cycled), one sequential
// hue for ordered buckets, and a reserved "critical" that always ships with a
// label. Text stays in ink colours; only the marks carry these.
export const SERIES = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"] as const;
export const ORDINAL = ["#86b6ef", "#5598e7", "#2a78d6", "#184f95"] as const;
export const CRITICAL = "#d03b3b";
const TRACK = "#f1f0ec";

export interface BarRow {
  label: ReactNode;
  value: number;
  display: string; // value as shown at the bar's end
  note?: string; // small text under the label
  tip?: string; // hover text (defaults to "label: display")
  color?: string;
  flag?: string; // short warning shown beside the value (with the critical colour)
}

/** Horizontal bars from one baseline: label · bar · value. One series, so no legend. */
export function HBars({ rows, color = SERIES[0], max }: { rows: BarRow[]; color?: string; max?: number }) {
  const top = max ?? Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r, i) => (
        <li
          key={i}
          title={r.tip ?? `${typeof r.label === "string" ? r.label : ""} ${r.display}`.trim()}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
        >
          <span className="min-w-0 text-sm leading-snug">
            <span className="block truncate font-medium">{r.label}</span>
            {r.note && <span className="block truncate text-xs text-muted-foreground">{r.note}</span>}
          </span>
          {/* phone: value sits beside the label and the bar gets the full row below */}
          <span className="order-3 col-span-2 h-4 min-w-0 sm:order-none sm:col-span-1">
            <span
              className="block h-full rounded-r"
              style={{
                width: `${Math.max((Math.abs(r.value) / top) * 100, r.value ? 0.8 : 0)}%`,
                background: r.color ?? (r.flag ? CRITICAL : color),
              }}
            />
          </span>
          <span className="whitespace-nowrap text-right text-sm tabular-nums">
            {r.display}
            {r.flag && <span className="ml-1.5 font-semibold" style={{ color: CRITICAL }}>⚠ {r.flag}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export interface Part {
  label: string;
  value: number;
  display: string;
  color: string;
}

/** One 100% bar split into parts (2px surface gaps), with a legend that carries
 *  every name and value so nothing relies on colour alone. */
export function Segments({ parts }: { parts: Part[] }) {
  const shown = parts.filter((p) => p.value > 0);
  const total = shown.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-6 gap-[2px] overflow-hidden rounded">
        {shown.map((p) => (
          <span
            key={p.label}
            title={`${p.label}: ${p.display} (${((p.value / total) * 100).toFixed(1)}%)`}
            style={{ width: `${(p.value / total) * 100}%`, background: p.color }}
          />
        ))}
      </div>
      <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.label} className="flex min-w-0 items-baseline gap-2">
            <span aria-hidden className="mt-1 inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: p.color }} />
            <span className="min-w-0 flex-1">{p.label}</span>
            <span className="whitespace-nowrap tabular-nums text-muted-foreground">
              {p.display} · {((p.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** How much of a target is done — e.g. days closed out of days traded. */
export function Meter({ label, value, max, display, bad }: { label: string; value: number; max: number; display: string; bad?: boolean }) {
  const p = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="rounded-2xl border bg-card p-4" title={`${label}: ${display}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className="whitespace-nowrap text-lg font-bold tabular-nums">
          {bad && <span style={{ color: CRITICAL }}>⚠ </span>}
          {display}
        </span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ background: TRACK }}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(p * 100, p ? 1.5 : 0)}%`, background: bad ? CRITICAL : SERIES[0] }} />
      </div>
    </div>
  );
}

/** Small column chart for one series over the months — used side by side
 *  (small multiples) so stages with different sizes each keep their own scale. */
export function MiniCols({ title, total, data, color = SERIES[0] }: { title: string; total: string; data: { label: string; value: number; display: string }[]; color?: string }) {
  const top = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs tabular-nums text-muted-foreground">{total}</p>
      <div className="mt-2 flex h-24 items-end gap-[3px] border-b" style={{ borderColor: "#c3c2b7" }}>
        {data.map((d) => (
          <span key={d.label} title={`${d.label}: ${d.display}`} className="flex h-full flex-1 items-end justify-center">
            <span className="block w-full max-w-[24px] rounded-t" style={{ height: `${(d.value / top) * 100}%`, background: color }} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-muted-foreground">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center">{d.label}</span>
        ))}
      </div>
    </div>
  );
}

/** The full numbers behind a chart, folded away until asked for. */
export function Fold({ label, children }: { label: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none text-sm text-muted-foreground underline decoration-dotted">
        <span className="group-open:hidden">▸ </span>
        <span className="hidden group-open:inline">▾ </span>
        {label}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}
