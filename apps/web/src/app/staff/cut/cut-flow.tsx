"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type StockRow, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { useStaffDate } from "@/components/staff/staff-date";

const field = "w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

export function CutFlow({
  warehouseStock,
  itemTypes,
}: {
  warehouseStock: StockRow[];
  itemTypes: ItemType[];
}) {
  const router = useRouter();
  const { backdateIso, resetToToday } = useStaffDate();

  // Rolls = whatever has warehouse stock (sellable flags are inconsistent, so we
  // let the cutter pick the roll rather than guess). Outputs = any active item.
  const rolls = warehouseStock.filter((s) => s.qty > 0);
  const outputs = itemTypes.filter((t) => t.isActive);

  const [rollId, setRollId] = useState<number>(rolls[0]?.itemTypeId ?? 0);
  const [yards, setYards] = useState("");
  const [lines, setLines] = useState<{ itemTypeId: number; qty: string }[]>([
    { itemTypeId: outputs[0]?.id ?? 0, qty: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLine = (i: number, patch: Partial<{ itemTypeId: number; qty: string }>) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const selectedRoll = rolls.find((r) => r.itemTypeId === rollId);

  async function submit() {
    const outs = lines
      .map((l) => ({ itemTypeId: l.itemTypeId, qty: Math.max(0, Number(l.qty) || 0) }))
      .filter((o) => o.itemTypeId && o.qty > 0);
    const yd = Math.max(0, Number(yards) || 0);
    if (yd <= 0 && outs.length === 0) {
      setError(labels.cut.needSomething);
      return;
    }
    if (!rollId) {
      setError(labels.errors.required);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/cuts", {
        rollItemTypeId: rollId,
        yardsUsed: yd > 0 ? yd : undefined,
        outputs: outs,
        notes: notes.trim() || undefined,
        occurredAt: backdateIso(),
      });
      resetToToday();
      router.push("/staff/cuts?saved=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-28 sm:p-6">
      <div className="flex items-center justify-between gap-2">
        <Link href="/staff" className="rounded-lg border px-3 py-1.5 text-sm">
          ← {labels.staff.home}
        </Link>
        <h1 className="text-lg font-bold">{labels.cut.title}</h1>
        <Link href="/staff/cuts" className="rounded-lg border px-3 py-1.5 text-sm">
          {labels.cut.history}
        </Link>
      </div>

      {rolls.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {labels.cut.noRolls}
        </p>
      ) : (
        <>
          {/* Roll + yards used */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{labels.cut.roll}</span>
              <select value={rollId} onChange={(e) => setRollId(Number(e.target.value))} className={field}>
                {rolls.map((r) => (
                  <option key={r.itemTypeId} value={r.itemTypeId}>
                    {r.emoji ? `${r.emoji} ` : ""}
                    {r.labelMy} ({r.qty})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {labels.cut.yardsUsed}
                {selectedRoll ? ` — ${selectedRoll.qty}` : ""}
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={selectedRoll?.qty}
                value={yards}
                onChange={(e) => setYards(e.target.value)}
                className={field + " tabular-nums"}
              />
            </label>
          </section>

          {/* Pieces produced */}
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            <span className="text-sm font-medium">{labels.cut.outputItem}</span>
            {lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <select
                  value={l.itemTypeId}
                  onChange={(e) => setLine(i, { itemTypeId: Number(e.target.value) })}
                  className={field + " min-w-0 flex-1"}
                >
                  {outputs.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.emoji ? `${t.emoji} ` : ""}
                      {t.labelMy}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={l.qty}
                  onChange={(e) => setLine(i, { qty: e.target.value })}
                  placeholder={labels.cut.pieces}
                  className="w-24 rounded-lg border bg-background px-3 py-2 text-right text-base tabular-nums outline-none focus:ring-2 focus:ring-ring"
                />
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                    className="rounded-lg border px-2 py-1 text-xs text-destructive"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((p) => [...p, { itemTypeId: outputs[0]?.id ?? 0, qty: "" }])}
              className="self-start rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary"
            >
              + {labels.cut.addOutput}
            </button>
          </section>

          <section className="rounded-2xl border bg-card p-4">
            <textarea
              rows={2}
              maxLength={500}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={labels.transfer.notes}
              className={field}
            />
          </section>

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
              {error}
            </p>
          )}

          <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
            <div className="mx-auto max-w-2xl">
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow active:scale-[0.98] disabled:opacity-50"
              >
                ✂️ {submitting ? labels.common.saving : labels.common.save}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
