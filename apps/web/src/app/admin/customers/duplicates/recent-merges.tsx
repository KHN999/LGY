"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type CustomerMergeBatch } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatDateTime } from "@/lib/utils";
import { Button, Card } from "@/components/ui";

const L = labels.dup;

/** Merges done recently, each with an Undo that puts the records back. */
export function RecentMerges({ merges }: { merges: CustomerMergeBatch[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function undo(batchId: string) {
    if (!window.confirm(L.undoConfirm)) return;
    setBusy(batchId);
    setError(null);
    try {
      await api.post(`/customers/merges/${encodeURIComponent(batchId)}/undo`, {});
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setBusy(null);
    }
  }

  if (merges.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">↩ {L.recentTitle}</h2>
      <p className="text-sm text-muted-foreground">{L.recentHint}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Card>
        <ul className="divide-y">
          {merges.map((m) => (
            <li key={m.batchId} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div className="min-w-0 flex-1 basis-64">
                <p className="text-sm">
                  {m.sources.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 ? "၊ " : ""}
                      <span className="font-medium">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        (#{s.id} · {s.sales} {L.sales})
                      </span>
                    </span>
                  ))}{" "}
                  <span className="text-muted-foreground">→</span>{" "}
                  <Link href={`/admin/customers/${m.survivor.id}`} className="font-bold hover:underline">
                    {m.survivor.name}
                  </Link>
                  <span className="text-xs text-muted-foreground"> (#{m.survivor.id})</span>
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy !== null}
                onClick={() => undo(m.batchId)}
              >
                ↩ {busy === m.batchId ? labels.common.saving : L.undo}
              </Button>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
