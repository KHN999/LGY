import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { EmployeeForm } from "../employee-form";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate, yangonYmd } from "@/lib/utils";
import type { Employee, ExpenseRow, ExpenseCategory } from "@/lib/api-client";
import { PageHeader, Card } from "@/components/ui";
import { PaidTrendChart } from "@/components/admin/customer-charts";
import { PaySalaryButton } from "@/components/admin/pay-salary-button";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [employee, expenses, categories] = await Promise.all([
    serverFetch<Employee>(`/api/employees/${id}`),
    serverFetch<ExpenseRow[]>(`/api/expenses?employeeId=${id}`),
    serverFetch<ExpenseCategory[]>("/api/expenses/categories"),
  ]);
  if (!employee) notFound();

  const salaryCat = (categories ?? []).find((c) => c.key === "salary");

  const rows = expenses ?? [];
  const total = rows.reduce((s, e) => s + e.amount, 0);

  const map = new Map<string, number>();
  for (const e of rows) {
    const k = yangonYmd(e.expenseDate);
    map.set(k, (map.get(k) ?? 0) + e.amount);
  }
  const trend = [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([d, paid]) => ({ date: d.slice(5), paid }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        backHref="/admin/employees"
        backLabel={labels.admin.employees}
        title={employee.name}
        subtitle={employee.contact ?? undefined}
        action={
          salaryCat ? (
            <PaySalaryButton
              employeeId={employee.id}
              defaultAmount={employee.monthlySalary}
              categoryId={salaryCat.id}
            />
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.admin.monthly}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">
            {employee.monthlySalary != null ? formatKyat(employee.monthlySalary) : "—"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.customerDetail.paid}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{formatKyat(total)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{labels.salesAdmin.payments}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{rows.length}</p>
        </Card>
      </div>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.activity}</h2>
        <PaidTrendChart data={trend} />
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.recentPayments}</h2>
        {rows.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {labels.customerDetail.noPayments}
          </p>
        ) : (
          <ul className="flex flex-col divide-y">
            {rows.slice(0, 20).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 text-sm">
                  {formatDate(e.expenseDate)} · {e.category.labelMy}
                  {e.notes ? ` · ${e.notes}` : ""}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-rose-600">
                  {formatKyat(e.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">{labels.common.edit}</summary>
        <div className="mt-3">
          <EmployeeForm initial={employee} />
        </div>
      </details>
    </div>
  );
}
