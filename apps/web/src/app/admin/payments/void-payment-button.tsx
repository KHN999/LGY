"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";

/** Void a received payment (admin). Two-step: a reason is required, mirroring the
 *  sale-detail void. On success, refresh the list. */
export function VoidPaymentButton({ id }: { id: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/customer-payments/${id}/void`, { reason: reason.trim() });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 rounded-lg border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10"
      >
        {labels.salesAdmin.voidPayment}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex shrink-0 items-center gap-2">
      <input
        type="text"
        autoFocus
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={labels.salesAdmin.reason}
        maxLength={500}
        className="w-32 rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
      />
      <button
        type="submit"
        disabled={busy || reason.trim().length < 2}
        className="rounded-lg bg-destructive px-2 py-1.5 text-xs font-semibold text-destructive-foreground disabled:opacity-50"
      >
        {busy ? labels.common.saving : labels.salesAdmin.confirm}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setReason("");
        }}
        className="rounded-lg border px-2 py-1.5 text-xs"
      >
        {labels.common.cancel}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </form>
  );
}
