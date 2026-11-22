"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatKyat } from "@/lib/utils";

// Axis in သိန်း (lakh) — the unit the shop thinks in.
const axisLakh = (v: number) => (v / 100_000).toLocaleString("en-US", { maximumFractionDigits: 0 });
const money = (v: unknown) => formatKyat(Number(v) || 0);

export function TwoBars({
  data,
  aName,
  bName,
  unitNote,
  stacked = false,
}: {
  data: { label: string; a: number; b: number }[];
  aName: string;
  bName: string;
  unitNote: string;
  /** Stack b on top of a (parts of one total) instead of side by side. */
  stacked?: boolean;
}) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#e1e0d9" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={axisLakh} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={money} />
          <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span style={{ color: "#52514e" }}>{v}</span>} />
          <Bar name={aName} dataKey="a" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} stackId={stacked ? "s" : undefined} stroke="#fff" strokeWidth={stacked ? 2 : 0} />
          <Bar name={bName} dataKey="b" fill="#eb6834" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} stackId={stacked ? "s" : undefined} stroke="#fff" strokeWidth={stacked ? 2 : 0} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-xs text-muted-foreground">{unitNote}</p>
    </div>
  );
}

export function OneBar({
  data,
  name,
  unitNote,
}: {
  data: { label: string; a: number }[];
  name: string;
  unitNote: string;
}) {
  return (
    <div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#e1e0d9" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={4} />
          <YAxis tickFormatter={axisLakh} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={money} />
          <Bar name={name} dataKey="a" fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-1 text-right text-xs text-muted-foreground">{unitNote}</p>
    </div>
  );
}
