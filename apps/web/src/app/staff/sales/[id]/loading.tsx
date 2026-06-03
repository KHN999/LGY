import Link from "next/link";
import { labels } from "@/lib/labels";

export default function SaleReceiptLoading() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-28 sm:p-6">
      <Link href="/staff/sales" className="self-start rounded-lg border px-3 py-1.5 text-sm">
        {"<-"} {labels.history.title}
      </Link>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="animate-pulse p-5">
          <div className="mx-auto mb-4 h-6 w-40 rounded bg-muted" />
          <div className="mx-auto mb-6 h-4 w-56 rounded bg-muted" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="h-4 flex-1 rounded bg-muted" />
                <div className="h-4 w-20 rounded bg-muted" />
              </div>
            ))}
          </div>
          <div className="mt-6 border-t pt-4">
            <div className="ml-auto h-6 w-32 rounded bg-muted" />
          </div>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <div className="h-14 flex-1 animate-pulse rounded-2xl bg-muted" />
          <div className="h-14 flex-1 animate-pulse rounded-2xl bg-muted" />
        </div>
      </div>
    </main>
  );
}
