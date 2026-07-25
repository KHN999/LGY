import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import type { InventoryEvent } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";
import { SearchInput } from "@/components/search-input";

export const dynamic = "force-dynamic";

export default async function StaffWashesPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search } = await searchParams;
  const qs = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const washes = await serverFetch<InventoryEvent[]>(`/api/wash${qs}`);
  const rows = washes ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-10 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/staff" className="rounded-lg border px-3 py-1.5 text-sm">
          ← {labels.staff.home}
        </Link>
        <h1 className="text-lg font-bold">{labels.wash.history}</h1>
        <Link
          href="/staff/wash"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          + {labels.staff.wash}
        </Link>
      </div>

      <SearchInput placeholder={labels.wash.searchItem} />

      {rows.length === 0 ? (
        <EmptyState>{labels.wash.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => {
            const outIn = e.lines.filter((l) => l.direction === "IN");
            const total = outIn.reduce((s, l) => s + l.qty, 0);
            return (
              <li key={e.id} className="p-4">
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(e.occurredAt)}
                  {e.voidedAt ? ` · ${labels.salesAdmin.voided}` : ""}
                </p>
                <p className="mt-1 font-medium">
                  <span className="text-emerald-700">
                    {total} {labels.wash.qty}
                  </span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {outIn
                    .map((l) => `${l.itemType?.labelMy ?? `#${l.itemTypeId}`} ×${l.qty}`)
                    .join(" · ")}
                </p>
                {e.notes && <p className="truncate text-xs text-muted-foreground">📝 {e.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
