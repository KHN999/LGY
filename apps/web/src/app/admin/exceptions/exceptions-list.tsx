"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type StockExceptionRow } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button, EmptyState } from "@/components/ui";

export function ExceptionsList({ rows }: { rows: StockExceptionRow[] }) {
  if (rows.length === 0) {
    return <EmptyState>{labels.exceptions.none}</EmptyState>;
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <ExceptionCard key={r.id} row={r} />
      ))}
    </ul>
  );
}

function ExceptionCard({ row }: { row: StockExceptionRow }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locLabel = row.location === "SHOP" ? labels.transfer.locShop : row.location;

  async function resolve(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason.trim()) {
      setError(labels.errors.required);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/stock-exceptions/${row.id}/resolve`, {
        countedQty: counted.trim() === "" ? undefined : Math.max(0, Number(counted) || 0),
        reason: reason.trim(),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            {row.itemType.emoji ? row.itemType.emoji + " " : ""}
            {row.itemType.labelMy}
            <span className="ml-2 text-sm font-normal text-muted-foreground">@ {locLabel}</span>
          </p>
          <p className="mt-1 text-sm">
            <span className="text-muted-foreground">{labels.exceptions.systemStock}: </span>
            <span className={row.currentStock < 0 ? "font-bold text-rose-600" : "font-semibold"}>
              {row.currentStock}
            </span>
            <span className="ml-3 text-muted-foreground">{labels.exceptions.soldBeyond}: </span>
            <span className="font-semibold">{row.soldBeyondTotal}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {labels.exceptions.lastSeen}:{" "}
            {new Date(row.lastDetectedAt).toLocaleString("en-US", { hour12: true })}
          </p>
        </div>
        <Button type="button" onClick={() => setOpen((v) => !v)} className="shrink-0">
          {labels.exceptions.resolve}
        </Button>
      </div>

      {row.sales.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted-foreground">
            {labels.exceptions.contributingSales} ({row.sales.length})
          </summary>
          <ul className="mt-2 flex flex-col divide-y text-sm">
            {row.sales.map((s) => (
              <li key={s.saleId} className="flex items-center justify-between gap-2 py-1.5">
                <span>
                  #{s.saleId} · {s.customerName ?? labels.sell.walkInCustomer}
                  {s.voided && <span className="ml-1 text-rose-600">({labels.exceptions.voided})</span>}
                </span>
                <span className="text-muted-foreground">
                  {new Date(s.saleDate).toLocaleDateString("en-US")} · ×{s.qtyBeyond}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {open && (
        <form onSubmit={resolve} className="mt-3 flex flex-col gap-3 border-t pt-3">
          <Field label={labels.exceptions.countedQty} hint={labels.exceptions.countedQtyHint}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={labels.exceptions.reason}>
            <input
              type="text"
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" disabled={submitting} className="self-start">
            {submitting ? labels.common.saving : labels.exceptions.resolveSubmit}
          </Button>
        </form>
      )}
    </li>
  );
}
