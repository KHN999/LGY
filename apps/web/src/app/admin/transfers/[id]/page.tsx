import Link from "next/link";
import type { ReactNode } from "react";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatDateTime, formatKyat } from "@/lib/utils";
import type { InventoryEvent } from "@/lib/api-client";
import { PageHeader, Card, EmptyState } from "@/components/ui";
import { VoidTransferButton } from "../void-transfer-button";

export const dynamic = "force-dynamic";

const LOC: Record<string, string> = {
  WAREHOUSE: labels.transfer.locWarehouse,
  SHOP: labels.transfer.locShop,
  IN_TRANSIT: labels.transfer.locInTransit,
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const e = await serverFetch<InventoryEvent>(`/api/transfers/${id}`);

  if (!e) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/admin/transfers" className="text-sm text-muted-foreground hover:underline">
          ← {labels.transfer.history}
        </Link>
        <PageHeader title={`${labels.transfer.slipTitle} #${id}`} />
        <EmptyState>{labels.common.noData}</EmptyState>
      </div>
    );
  }

  const out = e.lines.filter((l) => l.direction === "OUT");
  const from = out[0]?.location;
  const to = e.lines.find((l) => l.direction === "IN")?.location;
  const totalPieces = out.reduce((s, l) => s + l.qty, 0);
  const delivery = e.expenses?.[0];
  const driver = delivery?.paidToDriver?.name ?? delivery?.paidTo ?? null;

  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/transfers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.transfer.history}
      </Link>

      <div className="flex items-start justify-between gap-3">
        <PageHeader title={`${labels.transfer.slipTitle} #${e.id}`} />
        {e.voidedAt ? (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-600">
            {labels.salesAdmin.voided}
          </span>
        ) : (
          <VoidTransferButton id={e.id} redirectTo="/admin/transfers" />
        )}
      </div>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3 text-lg font-semibold">
          <span>{LOC[from ?? ""] ?? from ?? "?"}</span>
          <span className="text-muted-foreground">→</span>
          <span>{LOC[to ?? ""] ?? to ?? "?"}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Field label={labels.transfer.date}>{formatDateTime(e.occurredAt)}</Field>
          <Field label={labels.transfer.totalPieces}>{totalPieces}</Field>
          <Field label={labels.transfer.driver}>{driver ?? labels.transfer.noDriver}</Field>
          {delivery ? <Field label={labels.transfer.driverFee}>{formatKyat(delivery.amount)}</Field> : null}
          {e.createdBy ? (
            <Field label={labels.transfer.recordedBy}>{e.createdBy.displayName}</Field>
          ) : null}
        </dl>

        {e.notes ? <p className="text-sm text-muted-foreground">{e.notes}</p> : null}
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-base font-semibold">{labels.transfer.items}</h2>
        <ul className="flex flex-col divide-y">
          {out.map((l) => (
            <li key={l.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2">
                {l.itemType?.emoji ? <span className="text-xl">{l.itemType.emoji}</span> : null}
                <span>{l.itemType?.labelMy ?? `#${l.itemTypeId}`}</span>
              </span>
              <span className="text-lg font-bold tabular-nums">{l.qty}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}
