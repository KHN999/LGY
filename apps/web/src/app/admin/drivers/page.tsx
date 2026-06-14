import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Driver } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; search?: string }>;
}) {
  const params = await searchParams;
  const search = params.search?.trim() ?? "";
  const apiParams = new URLSearchParams({ limit: "200" });
  if (search) apiParams.set("search", search);
  const data = await serverFetch<Page<Driver>>(`/api/drivers?${apiParams.toString()}`);
  const rows = data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.drivers}
        action={
          <Link href="/admin/drivers/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      <SearchInput />
      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.drivers}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/drivers/${d.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.name}</p>
                  {d.contact && <p className="text-sm text-muted-foreground truncate">{d.contact}</p>}
                </div>
                {d.defaultFee !== null && (
                  <p className="shrink-0 text-right text-sm text-muted-foreground">
                    {labels.admin.feePerTrip}: {formatKyat(d.defaultFee)}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
