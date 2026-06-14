import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Tailor } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

export default async function TailorsPage({
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
  const data = await serverFetch<Page<Tailor>>(`/api/tailors?${apiParams.toString()}`);
  const rows = data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.tailors}
        action={
          <Link href="/admin/tailors/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      <SearchInput />
      {rows.length === 0 ? (
        <EmptyState>{labels.admin.empty.tailors}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/tailors/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  {t.contact && <p className="text-sm text-muted-foreground truncate">{t.contact}</p>}
                  {t.defaultFeePerPiece !== null && (
                    <p className="text-sm text-muted-foreground">{labels.admin.feePerPiece}: {formatKyat(t.defaultFeePerPiece)}</p>
                  )}
                </div>
                {t.balance !== 0 && (
                  <p className={"shrink-0 text-right text-sm font-medium " + (t.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {t.balance > 0 ? labels.admin.toPay : "credit"}: {formatKyat(Math.abs(t.balance))}
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
