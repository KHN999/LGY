import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { SaleDetail } from "@/lib/api-client";
import { SaleDetailActions } from "./sale-detail";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await serverFetch<SaleDetail>(`/api/sales/${id}`);
  if (!sale) notFound();

  const remaining = sale.grandTotal - sale.paidAmount;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/sales"
        backLabel={labels.salesAdmin.title}
        title={`#${sale.id} ${sale.customer?.name ?? labels.salesAdmin.walkIn}`}
        action={
          sale.voidedAt ? (
            <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {labels.salesAdmin.voided}
            </span>
          ) : undefined
        }
      />
      <p className="-mt-2 text-sm text-muted-foreground">
        {new Date(sale.saleDate).toLocaleString("en-US", { hour12: true })}
      </p>

      <section className="rounded-2xl border bg-card p-4">
        <ul className="flex flex-col divide-y">
          {sale.lines.map((l) => (
            <li key={l.id} className="flex items-start justify-between gap-3 py-2">
              <div>
                <span>
                  {l.itemType?.emoji ?? "🧾"} {l.itemType?.labelMy ?? l.itemName} × {l.qty}{" "}
                  <span className="text-xs text-muted-foreground">@ {formatKyat(l.unitPrice)}</span>
                </span>
                {l.note && <p className="text-xs text-muted-foreground">📝 {l.note}</p>}
              </div>
              <span className="font-medium">{formatKyat(l.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between border-t pt-2">
          <span className="font-semibold">{labels.sell.grandTotal}</span>
          <span className="text-xl font-bold">{formatKyat(sale.grandTotal)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{labels.domain.paid}</span>
          <span>{formatKyat(sale.paidAmount)}</span>
        </div>
        {!sale.voidedAt && remaining > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{labels.domain.remaining}</span>
            <span className="text-rose-600">{formatKyat(remaining)}</span>
          </div>
        )}
      </section>

      <SaleDetailActions sale={sale} />
    </div>
  );
}
