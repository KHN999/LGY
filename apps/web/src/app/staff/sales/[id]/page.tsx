import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import type { SaleDetail, SaleReturnRow, ShopSettings } from "@/lib/api-client";
import { ReceiptView } from "./receipt-view";
import { BackToSalesButton } from "../back-to-sales-button";

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
      <BackToSalesButton />
      <ReceiptView sale={sale} returns={returns ?? []} shop={shop ?? undefined} />
    </main>
  );
}
