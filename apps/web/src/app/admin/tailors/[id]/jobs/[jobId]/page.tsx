import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { InventoryEvent, Tailor, ShopSettings } from "@/lib/api-client";
import { TailorJobView } from "./job-view";

export const dynamic = "force-dynamic";

export default async function TailorJobSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; jobId: string }>;
  searchParams: Promise<{ print?: string }>;
}) {
  const { id, jobId } = await params;
  const sp = await searchParams;
  const [job, tailor, shop] = await Promise.all([
    serverFetch<InventoryEvent>(`/api/tailors/jobs/${jobId}`),
    serverFetch<Tailor>(`/api/tailors/${id}`),
    serverFetch<ShopSettings>("/api/settings"),
  ]);
  if (!job) notFound();

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/admin/tailors/${id}`} className="self-start rounded-lg border px-3 py-1.5 text-sm">
        ← {labels.admin.tailors}
      </Link>
      <TailorJobView
        job={job}
        tailorName={tailor?.name ?? ""}
        shop={shop ?? undefined}
        autoPrint={sp.print === "1"}
      />
    </div>
  );
}
