import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Employee, ExpenseCategory } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";
import { PaySalaryButton } from "@/components/admin/pay-salary-button";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const [data, categories] = await Promise.all([
    serverFetch<Page<Employee>>("/api/employees?limit=200"),
    serverFetch<ExpenseCategory[]>("/api/expenses/categories"),
  ]);
  const rows = data?.data ?? [];
  const salaryCat = (categories ?? []).find((c) => c.key === "salary");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.employees}
        action={
          <Link href="/admin/employees/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.employees}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 pr-3">
              <Link
                href={`/admin/employees/${e.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 hover:bg-accent"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{e.name}</p>
                  {e.contact && <p className="text-sm text-muted-foreground truncate">{e.contact}</p>}
                </div>
                {e.monthlySalary !== null && (
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {labels.admin.monthly}: {formatKyat(e.monthlySalary)}
                  </span>
                )}
              </Link>
              {salaryCat && (
                <PaySalaryButton
                  employeeId={e.id}
                  defaultAmount={e.monthlySalary}
                  categoryId={salaryCat.id}
                  compact
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
