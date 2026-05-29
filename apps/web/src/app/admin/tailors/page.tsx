import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Tailor } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function TailorsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; activeOnly?: string }>;
}) {
  const params = await searchParams;
  const showInactive = params.activeOnly === "false";
  const data = await serverFetch<Page<Tailor>>(
    `/api/tailors?limit=200${showInactive ? "&activeOnly=false" : ""}`,
  );
  const rows = data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{labels.admin.tailors}</h1>
        <Link href="/admin/tailors/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          + {labels.common.addNew}
        </Link>
      </div>
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{labels.admin.empty.tailors}</div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/tailors/${t.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{t.name}</p>
                  {t.contact && <p className="text-sm text-muted-foreground truncate">{t.contact}</p>}
                  {t.defaultFeePerPiece !== null && (
                    <p className="text-xs text-muted-foreground">တစ်ထည်ခ: {formatKyat(t.defaultFeePerPiece)}</p>
                  )}
                </div>
                {t.balance !== 0 && (
                  <p className={"text-sm font-medium " + (t.balance > 0 ? "text-rose-600" : "text-emerald-600")}>
                    {t.balance > 0 ? "ပေးရန်" : "credit"}: {formatKyat(Math.abs(t.balance))}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
