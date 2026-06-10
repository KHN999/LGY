"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";

/** Delete (void) a return — reverses the stock-back event and the customer's
 *  balance/refund. Two-tap confirm. */
export function VoidReturnButton({ id }: { id: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVoid() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/returns/${id}/void`, {});
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        🗑 {labels.returnsAdmin.delete}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        className="rounded-lg border px-2 py-1 text-xs"
      >
        {labels.common.cancel}
      </button>
      <button
        type="button"
        onClick={onVoid}
        disabled={busy}
        className="rounded-lg bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {busy ? labels.common.saving : labels.returnsAdmin.delete}
      </button>
    </div>
  );
}
