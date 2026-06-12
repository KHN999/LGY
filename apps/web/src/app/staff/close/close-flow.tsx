"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type DailyClosePreview } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { useStaffDate } from "@/components/staff/staff-date";

interface Props {
  preview: DailyClosePreview;
}

export function CloseFlow({ preview }: Props) {
  const router = useRouter();
  const { ymd } = useStaffDate();
  const [pv, setPv] = useState<DailyClosePreview>(preview);
  const [counted, setCounted] = useState<number>(preview.expectedCash);
  const [keep, setKeep] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The page server-renders today's preview; when a different day is selected
  // (backdate), fetch that day's preview so the close reconciles THAT day.
  useEffect(() => {
    let cancel = false;
    if (ymd === preview.date) {
      setPv(preview);
      setCounted(preview.expectedCash);
      return;
    }
    api
      .get<DailyClosePreview>(`/daily-close/preview?date=${ymd}`)
      .then((p) => {
        if (cancel) return;
        setPv(p);
        setCounted(p.expectedCash);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [ymd, preview]);

  const difference = counted - pv.expectedCash;

  async function onSubmit() {
    if (pv.alreadyClosed) {
      setError(labels.close.alreadyClosed);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/daily-close", {
        date: pv.date,
        countedCash: counted,
        carryForward: Math.min(keep, counted),
        notes: notes.trim() || undefined,
      });
      router.push("/staff?saved=close");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{labels.backdate.date}: {pv.date}</p>
        {pv.alreadyClosed && (
          <p className="mt-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-900">
            {labels.close.alreadyClosed}
          </p>
        )}
      </div>

      <Row label={labels.close.openingCash} value={pv.openingCash} />
      <Row label={labels.close.received} value={pv.receivedTotal} positive />
      <Row label={labels.close.paidOut} value={pv.paidOutTotal} negative />

      <div className="rounded-2xl border-2 border-primary/30 bg-card p-4">
        <p className="text-sm text-muted-foreground">{labels.close.expectedCash}</p>
        <p className="mt-1 text-3xl font-bold">{formatKyat(pv.expectedCash)}</p>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">{labels.close.countedCash}</p>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={counted || ""}
          onChange={(e) => setCounted(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-xl border bg-background px-4 py-3 text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">{labels.close.difference}</p>
        <p
          className={
            "mt-1 text-2xl font-bold " +
            (difference < 0 ? "text-rose-600" : difference > 0 ? "text-emerald-600" : "")
          }
        >
          {difference > 0 ? "+" : ""}{formatKyat(difference)}
          {difference < 0 && (
            <span className="ml-2 text-base font-normal">({labels.close.differenceShortfall})</span>
          )}
          {difference > 0 && (
            <span className="ml-2 text-base font-normal">({labels.close.differenceSurplus})</span>
          )}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">{labels.close.keepForTomorrow}</p>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={counted}
          value={keep || ""}
          onChange={(e) => setKeep(Math.max(0, Number(e.target.value) || 0))}
          className="w-full rounded-xl border bg-background px-4 py-3 text-center text-2xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          {labels.close.takeHome}: {formatKyat(Math.max(0, counted - keep))}
        </p>
      </div>

      <textarea
        rows={2}
        maxLength={500}
        placeholder={labels.common.optional}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="rounded-2xl border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
      />

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || pv.alreadyClosed}
        className="rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white shadow-lg disabled:opacity-50"
      >
        {submitting ? labels.common.saving : labels.close.save}
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: number;
  positive?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border bg-card p-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={
          "text-xl font-semibold " +
          (positive ? "text-emerald-600" : negative ? "text-rose-600" : "")
        }
      >
        {positive ? "+" : negative ? "−" : ""}{formatKyat(value)}
      </span>
    </div>
  );
}
