import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { InventoryEvent, ShopSettings } from "@/lib/api-client";
import { TransferView } from "./transfer-view";

export const dynamic = "force-dynamic";

export default async function StaffTransferSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const [transfer, shop] = await Promise.all([
    serverFetch<InventoryEvent>(`/api/transfers/${id}`),
    serverFetch<ShopSettings>("/api/settings"),
  ]);
  if (!transfer) notFound();

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-28 sm:p-6">
      <Link href="/staff/transfers" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.transfer.history}
      </Link>
      <TransferView transfer={transfer} shop={shop ?? undefined} autoPrint={sp.print === "1"} />
    </main>
  );
}
