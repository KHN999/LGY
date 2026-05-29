import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import type { Page, Driver } from "@/lib/api-client";

export const dynamic = "force-dynamic";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const params = await searchParams;
  const data = await serverFetch<Page<Driver>>("/api/drivers?limit=200");
  const rows = data?.data ?? [];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{labels.admin.drivers}</h1>
        <Link href="/admin/drivers/new" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          + {labels.common.addNew}
        </Link>
      </div>
      {params.saved && <p className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-900">{labels.admin.saved}</p>}
      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">{labels.admin.empty.drivers}</div>
      ) : (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((d) => (
            <li key={d.id}>
              <Link href={`/admin/drivers/${d.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{d.name}</p>
                  {d.contact && <p className="text-sm text-muted-foreground truncate">{d.contact}</p>}
                </div>
                {d.defaultFee !== null && (
                  <p className="text-xs text-muted-foreground">တစ်ခေါက်: {formatKyat(d.defaultFee)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
