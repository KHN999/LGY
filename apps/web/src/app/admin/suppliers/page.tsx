import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Supplier } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; activeOnly?: string; search?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.activeOnly === "false";
  const search = params.search?.trim() ?? "";
  const apiParams = new URLSearchParams({ limit: "200" });
  if (showInactive) apiParams.set("activeOnly", "false");
  if (search) apiParams.set("search", search);
  const data = await serverFetch<Page<Supplier>>(`/api/suppliers?${apiParams.toString()}`);
  const rows = data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.suppliers}
        action={
          <Link href="/admin/suppliers/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      <SearchInput />
      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.suppliers}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/suppliers/${s.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{s.name}</p>
                  {s.contact && <p className="text-sm text-muted-foreground truncate">{s.contact}</p>}
                </div>
                {s.balance > 0 && (
                  <p className="shrink-0 text-right text-sm font-medium text-rose-600">{labels.admin.toPay}: {formatKyat(s.balance)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
