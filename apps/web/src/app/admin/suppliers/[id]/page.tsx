import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { SupplierForm } from "../supplier-form";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Supplier } from "@/lib/api-client";
import { PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await serverFetch<Supplier>(`/api/suppliers/${id}`);
  if (!s) notFound();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        backHref="/admin/suppliers"
        backLabel={labels.admin.suppliers}
        title={s.name}
      />
      {s.balance > 0 && (
        <p className="-mt-2 text-sm">{labels.admin.order.remaining}: <span className="text-rose-600">{formatKyat(s.balance)}</span></p>
      )}
      <SupplierForm initial={s} />
    </div>
  );
}
