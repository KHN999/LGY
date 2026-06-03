import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { TailorForm } from "../tailor-form";
import { labels } from "@/lib/labels";
import { formatDate } from "@/lib/utils";
import type { TailorDetail, StockRow, ItemType, InventoryEvent } from "@/lib/api-client";
import { PageHeader, Card } from "@/components/ui";
import { TailorLedger } from "./tailor-ledger";
import { TailorWork } from "./tailor-work";

export const dynamic = "force-dynamic";

export default async function EditTailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, warehouseStock, itemTypes, jobs] = await Promise.all([
    serverFetch<TailorDetail>(`/api/tailors/${id}`),
    serverFetch<StockRow[]>("/api/inventory/stock?location=WAREHOUSE"),
    serverFetch<ItemType[]>("/api/item-types"),
    serverFetch<InventoryEvent[]>(`/api/tailors/${id}/jobs`),
  ]);
  if (!t) notFound();
  const jobRows = jobs ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/admin/tailors" backLabel={labels.admin.tailors} title={t.name} />

      <TailorWork tailor={t} warehouseStock={warehouseStock ?? []} itemTypes={itemTypes ?? []} />

      {jobRows.length > 0 && (
        <Card className="p-4">
          <h2 className="mb-2 text-sm font-semibold">{labels.tailorWork.history}</h2>
          <ul className="flex flex-col divide-y">
            {jobRows.map((j) => {
              const out = j.lines.filter((l) => l.direction === "OUT").reduce((s, l) => s + l.qty, 0);
              const isReceive = j.kind === "TAILOR_RETURN";
              return (
                <li key={j.id}>
                  <Link
                    href={`/admin/tailors/${id}/jobs/${j.id}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-accent"
                  >
                    <span className="text-sm">
                      {isReceive ? "↩ " : "📤 "}
                      {isReceive ? labels.tailorWork.receiveSlip : labels.tailorWork.sendSlip} ·{" "}
                      {formatDate(j.occurredAt)}
                    </span>
                    <span className="shrink-0 text-sm text-muted-foreground">
                      {out} {labels.units.htee}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <TailorLedger tailor={t} />

      <details className="rounded-2xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">{labels.common.edit}</summary>
        <div className="mt-3">
          <TailorForm initial={t} />
        </div>
      </details>
    </div>
  );
}
