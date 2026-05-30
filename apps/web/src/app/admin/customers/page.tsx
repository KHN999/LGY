import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Customer } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; activeOnly?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.activeOnly === "false";
  const data = await serverFetch<Page<Customer>>(
    `/api/customers?limit=200${showInactive ? "&activeOnly=false" : ""}`,
  );
  const rows = data?.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.customers}
        action={
          <Link href="/admin/customers/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />

      {params.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      <div className="flex gap-3 text-sm">
        <Link
          href="/admin/customers"
          className={
            "rounded-md px-2 py-1 " +
            (!showInactive ? "bg-accent" : "text-muted-foreground hover:bg-accent")
          }
        >
          {labels.admin.activeOnly}
        </Link>
        <Link
          href="/admin/customers?activeOnly=false"
          className={
            "rounded-md px-2 py-1 " +
            (showInactive ? "bg-accent" : "text-muted-foreground hover:bg-accent")
          }
        >
          {labels.admin.showInactive}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.customers}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                href={`/admin/customers/${c.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.name}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {c.defaultKind === "WHOLESALE"
                        ? labels.domain.wholesale
                        : labels.domain.retail}
                    </span>
                    {c.status === "INACTIVE" && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {labels.admin.inactive}
                      </span>
                    )}
                  </div>
                  {c.contact && (
                    <p className="text-sm text-muted-foreground truncate">{c.contact}</p>
                  )}
                </div>
                <div className="text-right">
                  <p
                    className={
                      "text-sm " + (c.balance > 0 ? "text-rose-600 font-medium" : "text-muted-foreground")
                    }
                  >
                    {labels.domain.debt}: {formatKyat(c.balance)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
