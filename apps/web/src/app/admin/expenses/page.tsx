import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { ExpenseRow, ExpenseCategory, Page, Employee, Driver } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { DateFilter } from "@/components/admin/date-filter";
import { ExpensesManager } from "./expenses-manager";

export const dynamic = "force-dynamic";

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { from, to } = await searchParams;
  const p = new URLSearchParams();
  if (from) p.set("from", from);
  if (to) p.set("to", to);
  const qs = p.toString();

  const [expenses, categories, employees, drivers] = await Promise.all([
    serverFetch<ExpenseRow[]>(`/api/expenses${qs ? `?${qs}` : ""}`),
    serverFetch<ExpenseCategory[]>("/api/expenses/categories"),
    serverFetch<Page<Employee>>("/api/employees?limit=200"),
    serverFetch<Page<Driver>>("/api/drivers?limit=200"),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={labels.expenses.title} />
      <DateFilter />
      <ExpensesManager
        expenses={expenses ?? []}
        categories={categories ?? []}
        employees={employees?.data ?? []}
        drivers={drivers?.data ?? []}
      />
    </div>
  );
}
