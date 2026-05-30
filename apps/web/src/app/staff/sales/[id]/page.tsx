import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { SaleDetail, SaleReturnRow, ShopSettings } from "@/lib/api-client";
import { ReceiptView } from "./receipt-view";

export const dynamic = "force-dynamic";

export default async function StaffSaleReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [sale, returns, shop] = await Promise.all([
    serverFetch<SaleDetail>(`/api/sales/${id}`),
    serverFetch<SaleReturnRow[]>(`/api/returns/by-sale/${id}`),
    serverFetch<ShopSettings>("/api/settings"),
  ]);
  if (!sale) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-28 sm:p-6">
      <Link href="/staff/sales" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.history.title}
      </Link>
      <ReceiptView sale={sale} returns={returns ?? []} shop={shop ?? undefined} />
    </main>
  );
}
