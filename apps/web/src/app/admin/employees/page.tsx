import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Employee } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const data = await serverFetch<Page<Employee>>("/api/employees?limit=200");
  const rows = data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{labels.admin.employees}</h1>
        <Link href="/admin/employees/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          + {labels.common.addNew}
        </Link>
      </div>
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{labels.admin.empty.employees}</div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => (
            <li key={e.id}>
              <Link href={`/admin/employees/${e.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{e.name}</p>
                  {e.contact && <p className="text-sm text-muted-foreground truncate">{e.contact}</p>}
                </div>
                {e.monthlySalary !== null && (
                  <p className="text-xs text-muted-foreground">လစဉ်: {formatKyat(e.monthlySalary)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
