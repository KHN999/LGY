"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api, ApiError, type InventoryEvent, type ItemType, type ShopSettings } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Button } from "@/components/ui";
import { inputClass } from "@/components/admin/form-field";
import { TailorJobReceipt, type TailorJobSlip } from "@/components/admin/tailor-job-receipt";

const lineLabel = (l: { itemType?: ItemType; itemTypeId: number }) =>
  `${l.itemType?.emoji ?? ""} ${l.itemType?.labelMy ?? `#${l.itemTypeId}`}`.trim();

export function TailorJobView({
  job,
  tailorName,
  shop,
  autoPrint = false,
}: {
  job: InventoryEvent;
  tailorName: string;
  shop?: ShopSettings;
  autoPrint?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const printedRef = useRef(false);
  useEffect(() => setMounted(true), []);

  const isReceive = job.kind === "TAILOR_RETURN";
  // For a receive, "sent" = pieces that left the tailor: the good ones (this
  // event's OUT@TAILOR) plus the spoiled ones (the linked LOSS event's OUT@TAILOR).
  // Aggregate by item so an input split across the return + its loss shows once.
  const sentMap = new Map<number, { label: string; qty: number }>();
  const addSent = (l: { itemType?: ItemType; itemTypeId: number; qty: number }) => {
    const cur = sentMap.get(l.itemTypeId) ?? { label: lineLabel(l), qty: 0 };
    cur.qty += l.qty;
    sentMap.set(l.itemTypeId, cur);
  };
  if (isReceive) {
    job.lines
      .filter((l) => l.direction === "OUT" && l.location === "TAILOR")
      .forEach(addSent);
    (job.derivedEvents ?? []).forEach((e) =>
      e.lines
        .filter((l) => l.direction === "OUT" && l.location === "TAILOR")
        .forEach(addSent),
    );
  } else {
    job.lines
      .filter((l) => l.direction === "OUT" && l.location === "WAREHOUSE")
      .forEach(addSent);
  }
  const sent = [...sentMap.values()];
  const received = isReceive
    ? job.lines.filter((l) => l.direction === "IN" && l.location === "WAREHOUSE").map((l) => ({ label: lineLabel(l), qty: l.qty }))
    : [];
  const sentTotal = sent.reduce((s, l) => s + l.qty, 0);
  const recvTotal = received.reduce((s, l) => s + l.qty, 0);
  const fee = (job.tailorCharges ?? []).reduce((s, c) => s + c.amount, 0);

  const data: TailorJobSlip = {
    jobId: job.id,
    kind: isReceive ? "TAILOR_RETURN" : "TAILOR_SEND",
    date: job.occurredAt,
    tailorName,
    sent,
    received,
    loss: Math.max(0, sentTotal - recvTotal),
    fee,
    by: job.createdBy?.displayName ?? null,
  };

  useEffect(() => {
    if (mounted && !printedRef.current && autoPrint) {
      printedRef.current = true;
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [mounted, autoPrint]);

  return (
    <>
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <TailorJobReceipt data={data} shop={shop} />
      </div>

      {job.voidedAt && (
        <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
          {labels.salesAdmin.voided}
        </p>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={() => window.print()}
        className="self-start border-2 border-emerald-600 text-emerald-700"
      >
        🖨 {labels.history.reprint}
      </Button>

      {!job.voidedAt && <JobEditVoid jobId={job.id} currentDate={job.occurredAt} />}

      {mounted &&
        createPortal(
          <div id="print-receipt" className="hidden print:block">
            <TailorJobReceipt data={data} shop={shop} />
          </div>,
          document.body,
        )}
    </>
  );
}

/** Fix mistakes on a tailor job: re-date it, or undo it entirely (reverts stock;
 *  for a return also reverses the sewing fee + spoilage). */
function JobEditVoid({ jobId, currentDate }: { jobId: number; currentDate: string }) {
  const router = useRouter();
  const [date, setDate] = useState(currentDate.slice(0, 10));
  const [savingDate, setSavingDate] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);
  const [reason, setReason] = useState("");
  const [voiding, setVoiding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDate() {
    setSavingDate(true);
    setError(null);
    try {
      await api.patch(`/tailors/jobs/${jobId}`, { occurredAt: date });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setSavingDate(false);
    }
  }

  async function doVoid() {
    setVoiding(true);
    setError(null);
    try {
      await api.post(`/tailors/jobs/${jobId}/void`, { reason: reason.trim() || undefined });
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setVoiding(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          {labels.tailorWork.editDate}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputClass + " w-44"}
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={saveDate}
          disabled={savingDate || date.slice(0, 10) === currentDate.slice(0, 10)}
        >
          {savingDate ? labels.common.saving : labels.common.save}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!confirmVoid ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="self-start"
          onClick={() => setConfirmVoid(true)}
        >
          ↩ {labels.tailorWork.undoJob}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 p-3">
          <input
            type="text"
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={labels.salesAdmin.reason}
            maxLength={500}
            className={inputClass}
          />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="destructive" onClick={doVoid} disabled={voiding}>
              {voiding ? labels.common.saving : labels.tailorWork.undoJob}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setConfirmVoid(false);
                setReason("");
              }}
            >
              {labels.common.cancel}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
