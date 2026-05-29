import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { ItemType } from "@/lib/api-client";

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
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{labels.admin.itemTypes}</h1>
        <Link
          href="/admin/item-types/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
        >
          + {labels.common.addNew}
        </Link>
      </div>

      {params.saved && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">
          {labels.admin.saved}
        </p>
      )}

      {!types || types.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
          {labels.admin.empty.itemTypes}
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {types.map((t) => (
            <li key={t.id}>
              <Link
                href={`/admin/item-types/${t.id}`}
                className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
              >
                <div className="flex items-center gap-3">
                  {t.emoji && <span className="text-3xl">{t.emoji}</span>}
                  <div>
                    <p className="text-base font-semibold">{t.labelMy}</p>
                    <p className="font-mono text-xs text-muted-foreground">{t.key}</p>
                  </div>
                </div>
                {!t.isActive && (
                  <span className="rounded bg-muted px-2 py-0.5 text-xs">
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
