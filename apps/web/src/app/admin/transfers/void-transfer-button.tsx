"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";

/** Delete (reverse) a transfer — voids the inventory event so the stock moves
 *  back, and voids any linked delivery fee. Two-tap confirm. */
export function VoidTransferButton({ id, redirectTo }: { id: number; redirectTo?: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVoid() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/transfers/${id}/void`, {});
      // On the detail page the row vanishes from the list, so go back to it;
      // in the list, just refresh in place.
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
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
        🗑 {labels.common.delete}
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
        {busy ? labels.common.saving : labels.common.delete}
      </button>
    </div>
  );
}
