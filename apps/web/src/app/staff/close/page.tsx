import Link from "next/link";
import { serverFetch } from "@/lib/auth-server";
import { labels } from "@/lib/labels";
import type { DailyClosePreview } from "@/lib/api-client";
import { CloseFlow } from "./close-flow";

export const dynamic = "force-dynamic";

export default async function ClosePage() {
  const preview = await serverFetch<DailyClosePreview>("/api/daily-close/preview");
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <Link href="/staff" className="mb-4 inline-block rounded-lg border px-4 py-2">
        ← {labels.common.back}
      </Link>
      <h1 className="mb-4 text-center text-2xl font-bold">{labels.close.title}</h1>
      {preview ? <CloseFlow preview={preview} /> : (
        <p className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
          {labels.errors.unknown}
        </p>
      )}
    </main>
  );
}
