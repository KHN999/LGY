import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { TailorForm } from "../tailor-form";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Tailor } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditTailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await serverFetch<Tailor>(`/api/tailors/${id}`);
  if (!t) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/tailors"
        backLabel={labels.admin.tailors}
        title={t.name}
      />
      {t.balance !== 0 && (
        <p className={"-mt-2 text-sm " + (t.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
          {t.balance > 0 ? labels.admin.toPay : "credit"}: {formatKyat(Math.abs(t.balance))}
        </p>
      )}
      <TailorForm initial={t} />
    </div>
  );
}
