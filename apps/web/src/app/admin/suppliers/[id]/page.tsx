import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { SupplierForm } from "../supplier-form";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Supplier } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await serverFetch<Supplier>(`/api/suppliers/${id}`);
  if (!s) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/suppliers" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.suppliers}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{s.name}</h1>
        {s.balance > 0 && (
          <p className="mt-1 text-sm">ပေးရန်ကျန်: <span className="text-rose-600">{formatKyat(s.balance)}</span></p>
        )}
      </div>
      <SupplierForm initial={s} />
    </div>
  );
}
