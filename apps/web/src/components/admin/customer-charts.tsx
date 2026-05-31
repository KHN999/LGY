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
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";

const axisK = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const money = (v: unknown) => formatKyat(Number(v) || 0);

/** Per-customer: bought (on credit) vs paid, over time. */
export function CustomerActivityChart({
  data,
}: {
  data: { date: string; bought: number; paid: number }[];
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{labels.common.noData}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickFormatter={axisK} tick={{ fontSize: 11 }} width={36} />
        <Tooltip formatter={money} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar name={labels.customerDetail.bought} dataKey="bought" fill="#ef4444" radius={[3, 3, 0, 0]} />
        <Bar name={labels.customerDetail.paid} dataKey="paid" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Comparison across customers: who owes the most (horizontal bars). */
export function DebtComparisonChart({ data }: { data: { name: string; debt: number }[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{labels.common.noData}</p>;
  }
  const height = Math.max(160, data.length * 34 + 24);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
        <XAxis type="number" tickFormatter={axisK} tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
        <Tooltip formatter={money} />
        <Bar dataKey="debt" fill="#ef4444" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
