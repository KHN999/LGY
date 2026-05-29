import Link from "next/link";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/auth-server";
import { TailorForm } from "../tailor-form";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Tailor } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function EditTailorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await serverFetch<Tailor>(`/api/tailors/${id}`);
  if (!t) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/admin/tailors" className="text-sm text-muted-foreground hover:underline">
        ← {labels.admin.tailors}
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{t.name}</h1>
        {t.balance !== 0 && (
          <p className={"mt-1 text-sm " + (t.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
            {t.balance > 0 ? "ပေးရန်" : "credit"}: {formatKyat(Math.abs(t.balance))}
          </p>
        )}
      </div>
      <TailorForm initial={t} />
    </div>
  );
}
