import Link from "next/link";
import { labels } from "@/lib/labels";

export default function StaffSalesHistoryLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 sm:p-6">
      <Link href="/staff" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        {"<-"} {labels.common.back}
      </Link>
      <div className="h-7 w-36 animate-pulse rounded bg-muted" />
      <ul className="flex flex-col divide-y rounded-2xl border bg-card">
        {Array.from({ length: 8 }).map((_, i) => (
          <li key={i} className="flex items-center justify-between gap-3 p-4">
            <div className="min-w-0 flex-1 animate-pulse space-y-2">
              <div className="h-4 w-44 rounded bg-muted" />
              <div className="h-3 w-32 rounded bg-muted" />
            </div>
            <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          </li>
        ))}
      </ul>
    </main>
  );
}
