import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { InventoryEvent } from "@/lib/api-client";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const LOC: Record<string, string> = {
  WAREHOUSE: labels.transfer.locWarehouse,
  SHOP: labels.transfer.locShop,
  IN_TRANSIT: labels.transfer.locInTransit,
  TAILOR: "Tailor",
};

export default async function StaffTransfersPage() {
  const transfers = await serverFetch<InventoryEvent[]>("/api/transfers");
  const rows = transfers ?? [];

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-10 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/staff" className="rounded-lg border px-3 py-1.5 text-sm">
          ← {labels.staff.home}
        </Link>
        <h1 className="text-lg font-bold">{labels.transfer.history}</h1>
        <Link
          href="/staff/transfer"
          className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
        >
          + {labels.transfer.title}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState>{labels.transfer.empty}</EmptyState>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((e) => {
            const out = e.lines.filter((l) => l.direction === "OUT");
            const inLine = e.lines.find((l) => l.direction === "IN");
            const total = out.reduce((s, l) => s + l.qty, 0);
            return (
              <li key={e.id}>
                <Link
                  href={`/staff/transfers/${e.id}`}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="font-medium">
                      {LOC[out[0]?.location ?? ""] ?? out[0]?.location} →{" "}
                      {LOC[inLine?.location ?? ""] ?? inLine?.location}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(e.occurredAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                      {e.voidedAt ? ` · ${labels.salesAdmin.voided}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    {total} {labels.units.htee}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
