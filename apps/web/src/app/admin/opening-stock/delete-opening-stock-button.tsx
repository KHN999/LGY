"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";

/** Void an opening-stock entry (correct a mistake) — reverses its stock. Two-tap
 *  confirm; on success the list refreshes and the entry drops out. */
export function DeleteOpeningStockButton({ id }: { id: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/opening-stock/${id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="shrink-0 rounded-lg border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
      >
        {labels.common.delete}
      </button>
    );
  }

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <span className="text-xs text-muted-foreground">{labels.admin.openingStockDeleteConfirm}</span>
      <div className="flex gap-2">
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
          onClick={onDelete}
          disabled={busy}
          className="rounded-lg bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
        >
          {busy ? labels.common.saving : labels.common.delete}
        </button>
      </div>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
