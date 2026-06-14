"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";

type Candidate = { id: number; name: string; contact: string | null };

/**
 * Merge duplicate customer records INTO this one (admin). Search for the
 * duplicate(s) — the survivor's name is pre-filled, and matching is normalized so
 * "B-204" / "B 204" / "B204" all surface — tick the ones to absorb, confirm.
 * Their sales/payments/returns move here and they're retired; nothing is lost.
 */
export function MergeCustomer({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(name);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced normalized lookup of merge candidates (excludes this survivor).
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setCandidates([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const rows = await api.get<Candidate[]>(
          `/customers/similar?name=${encodeURIComponent(q)}&excludeId=${id}`,
        );
        setCandidates(rows);
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, open, id]);

  function toggle(cid: number) {
    setSelected((prev) => (prev.includes(cid) ? prev.filter((x) => x !== cid) : [...prev, cid]));
  }

  async function doMerge() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/customers/${id}/merge`, { sourceIds: selected });
      setOpen(false);
      setConfirming(false);
      setSelected([]);
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start rounded-lg border px-3 py-2 text-sm font-medium hover:bg-accent"
      >
        🔀 {labels.customerDetail.merge}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-3">
      <div>
        <p className="text-sm font-semibold">{labels.customerDetail.mergeTitle}</p>
        <p className="mt-1 text-xs text-muted-foreground">{labels.customerDetail.mergeHelp}</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={labels.customerDetail.mergeSearch}
        className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      {candidates.length === 0 ? (
        <p className="py-2 text-center text-xs text-muted-foreground">
          {loading ? "…" : labels.customerDetail.mergeEmpty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {candidates.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 p-2 hover:bg-accent">
                <input
                  type="checkbox"
                  checked={selected.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4"
                />
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{c.name}</span>
                  {c.contact && (
                    <span className="ml-2 text-xs text-muted-foreground">{c.contact}</span>
                  )}
                  <span className="ml-2 text-xs text-muted-foreground">#{c.id}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {confirming ? (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-400 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">{labels.customerDetail.mergeConfirm}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="rounded-lg border px-3 py-2 text-sm"
            >
              {labels.common.cancel}
            </button>
            <button
              type="button"
              onClick={doMerge}
              disabled={busy}
              className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? labels.common.saving : labels.customerDetail.mergeAction}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setSelected([]);
            }}
            className="rounded-lg border px-3 py-2 text-sm"
          >
            {labels.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={selected.length === 0}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {labels.customerDetail.mergeAction} ({selected.length})
          </button>
        </div>
      )}
    </div>
  );
}
