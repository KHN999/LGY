import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { ItemType } from "@/lib/api-client";
import { PageHeader, EmptyState, buttonClass } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ItemTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const types = await serverFetch<ItemType[]>("/api/item-types?activeOnly=false");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={labels.admin.itemTypes}
        action={
          <Link href="/admin/item-types/new" className={buttonClass("primary", "md")}>
            + {labels.common.addNew}
          </Link>
        }
      />

      {params.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      {!types || types.length === 0 ? (
        <EmptyState>{labels.admin.empty.itemTypes}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {types.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/item-types/${t.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {t.emoji && <span className="shrink-0 text-2xl">{t.emoji}</span>}
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">{t.labelMy}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">{t.key}</p>
                  </div>
                </div>
                {!t.isActive && (
                  <span className="shrink-0 rounded bg-muted px-2 py-0.5 text-xs">
                    {labels.admin.inactive}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
