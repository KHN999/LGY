import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { TailorForm } from "../tailor-form";
import { labels } from "@/lib/labels";
import type { TailorDetail } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";
import { TailorLedger } from "./tailor-ledger";

export const dynamic = "force-dynamic";

export default async function EditTailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await serverFetch<TailorDetail>(`/api/tailors/${id}`);
  if (!t) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader backHref="/admin/tailors" backLabel={labels.admin.tailors} title={t.name} />

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
