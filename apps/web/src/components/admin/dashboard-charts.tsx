"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";

const COLORS = [
  "#10b981",
  "#3b82f6",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#64748b",
];

const axisK = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const money = (v: unknown) => formatKyat(Number(v) || 0);

export function SalesExpenseBars({
  data,
}: {
  data: { date: string; sales: number; expenses: number }[];
}) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{labels.common.noData}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis tickFormatter={axisK} tick={{ fontSize: 11 }} width={36} />
        <Tooltip formatter={money} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar name={labels.salesAdmin.title} dataKey="sales" fill="#10b981" radius={[3, 3, 0, 0]} />
        <Bar name={labels.expenses.title} dataKey="expenses" fill="#ef4444" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ExpenseBreakdownPie({ data }: { data: { name: string; value: number }[] }) {
  if (data.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{labels.common.noData}</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={money} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
