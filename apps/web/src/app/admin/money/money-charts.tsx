"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";

// Same colours as the data-analysis page: blue = money in, orange = money out.
export const IN_COLOR = "#2a78d6";
export const OUT_COLOR = "#eb6834";
const BALANCE_COLOR = "#184f95";
const GRID = "#e1e0d9";

// Axis in သိန်း (lakh) — the unit the shop thinks in.
const axisLakh = (v: number) => (v / 100_000).toLocaleString("en-US", { maximumFractionDigits: 0 });
const money = (v: unknown) => formatKyat(Number(v) || 0);
/** YYYY-MM-DD → DD/MM */
const short = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

export function InOutBars({ data }: { data: { date: string; in: number; out: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: short(d.date) }));
  return (
    <div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 4 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
          <YAxis tickFormatter={axisLakh} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={money} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            formatter={(v) => <span style={{ color: "#52514e" }}>{v}</span>}
          />
          <Bar name={labels.moneyBook.moneyIn} dataKey="in" fill={IN_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          <Bar name={labels.moneyBook.moneyOut} dataKey="out" fill={OUT_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-xs text-muted-foreground">{labels.moneyBook.unitLakh}</p>
    </div>
  );
}

export function BalanceArea({ data }: { data: { date: string; closing: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: short(d.date) }));
  const hasNegative = rows.some((r) => r.closing < 0);
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={rows} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={12} />
          <YAxis tickFormatter={axisLakh} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={money} />
          {hasNegative && <ReferenceLine y={0} stroke="#8a8984" />}
          <Area
            name={labels.moneyBook.closing}
            type="monotone"
            dataKey="closing"
            stroke={BALANCE_COLOR}
            strokeWidth={2}
            fill={BALANCE_COLOR}
            fillOpacity={0.12}
            dot={rows.length <= 31 ? { r: 2.5, fill: BALANCE_COLOR, strokeWidth: 0 } : false}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-xs text-muted-foreground">{labels.moneyBook.unitLakh}</p>
    </div>
  );
}
