import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Customer } from "@/lib/api-client";
import { PageHeader, EmptyState, Card, buttonClass } from "@/components/ui";
import { DebtComparisonChart } from "@/components/admin/customer-charts";
import { ImportContacts } from "./import-contacts";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; activeOnly?: string; search?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.activeOnly === "false";
  const search = params.search?.trim() ?? "";
  // Load the whole customer list so the list AND the top-debtors chart are
  // complete — a 200 cap (sorted by name) dropped later-sorting names like
  // "ဦး…", hiding real customers/debtors. Search stays server-side (NFC-aware).
  const apiParams = new URLSearchParams({ limit: "1000" });
  if (showInactive) apiParams.set("activeOnly", "false");
  if (search) apiParams.set("search", search);
  const data = await serverFetch<Page<Customer>>(`/api/customers?${apiParams.toString()}`);
  const rows = data?.data ?? [];

  const topDebtors = rows
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 8)
    .map((c) => ({ name: c.name, debt: c.balance }));

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

      <ImportContacts />

      <div className="flex gap-3 text-sm">
        <Link
          href={search ? `/admin/customers?search=${encodeURIComponent(search)}` : "/admin/customers"}
          className={
            "rounded-md px-2 py-1 " +
            (!showInactive ? "bg-accent" : "text-muted-foreground hover:bg-accent")
          }
        >
          {labels.admin.activeOnly}
        </Link>
        <Link
          href={`/admin/customers?activeOnly=false${search ? `&search=${encodeURIComponent(search)}` : ""}`}
          className={
            "rounded-md px-2 py-1 " +
            (showInactive ? "bg-accent" : "text-muted-foreground hover:bg-accent")
          }
        >
          {labels.admin.showInactive}
        </Link>
      </div>

      <SearchInput />

      {topDebtors.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.customerDetail.topDebtors}</h2>
          <DebtComparisonChart data={topDebtors} />
        </Card>
      )}

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
