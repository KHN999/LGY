"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type StockRow } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button } from "@/components/ui";

type Loc = "WAREHOUSE" | "SHOP";

export function StockCountForm() {
  const router = useRouter();
  const [location, setLocation] = useState<Loc>("SHOP");
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function loadInto(data: StockRow[]) {
    setRows(data);
    const init: Record<number, string> = {};
    for (const r of data) init[r.itemTypeId] = String(r.qty);
    setCounts(init);
  }

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setInfo(null);
    api
      .get<StockRow[]>(`/inventory/stock?location=${location}`, ac.signal)
      .then((data) => loadInto(data))
      .catch((err) => {
        if (ac.signal.aborted) return;
        setError(err instanceof ApiError ? err.message : labels.errors.unknown);
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [location]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!reason.trim()) {
      setError(labels.errors.required);
      return;
    }
    if (!rows) return;
    const changed = rows
      .map((r) => ({
        itemTypeId: r.itemTypeId,
        countedQty: Math.max(0, Number(counts[r.itemTypeId] ?? r.qty) || 0),
        current: r.qty,
      }))
      .filter((c) => c.countedQty !== c.current)
      .map(({ itemTypeId, countedQty }) => ({ itemTypeId, countedQty }));
    if (changed.length === 0) {
      setInfo(labels.stockCount.noChange);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/adjustments", { location, counts: changed, reason: reason.trim() });
      setInfo(labels.stockCount.success);
      setReason("");
      router.refresh();
      const data = await api.get<StockRow[]>(`/inventory/stock?location=${location}`);
      loadInto(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Field label={labels.stockCount.location}>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value as Loc)}
          className={inputClass + " max-w-xs"}
        >
          <option value="SHOP">{labels.transfer.locShop}</option>
          <option value="WAREHOUSE">{labels.transfer.locWarehouse}</option>
        </select>
      </Field>

      {loading && <p className="text-muted-foreground">{labels.common.loading}</p>}

      {!loading && rows && rows.length > 0 && (
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {rows.map((r) => {
            const counted = counts[r.itemTypeId] ?? String(r.qty);
            const diff = (Number(counted) || 0) - r.qty;
            return (
              <li
                key={r.itemTypeId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3"
              >
                <span className="font-medium sm:flex-1">
                  {r.emoji ? r.emoji + " " : ""}
                  {r.labelMy}
                </span>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <span className="text-sm text-muted-foreground">
                    {labels.stockCount.systemQty}: {r.qty}
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={counted}
                    onChange={(e) =>
                      setCounts((p) => ({ ...p, [r.itemTypeId]: e.target.value }))
                    }
                    className={inputClass + " w-24 text-right"}
                    aria-label={`${r.labelMy} — ${labels.stockCount.countedQty}`}
                  />
                  <span
                    className={
                      "w-12 shrink-0 text-right text-sm font-semibold " +
                      (diff > 0 ? "text-emerald-600" : diff < 0 ? "text-rose-600" : "text-transparent")
                    }
                  >
                    {diff > 0 ? "+" : ""}
                    {diff}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && rows && rows.length === 0 && (
        <p className="rounded-lg border bg-card p-4 text-muted-foreground">
          {labels.stockCount.empty}
        </p>
      )}

      <Field label={labels.stockCount.reason}>
        <input
          type="text"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className={inputClass}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {info && (
        <p className="rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{info}</p>
      )}

      <Button type="submit" size="lg" disabled={submitting || loading} className="self-start">
        {submitting ? labels.common.saving : labels.stockCount.submit}
      </Button>
    </form>
  );
}
