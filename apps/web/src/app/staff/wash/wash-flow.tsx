"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type StockRow, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { useStaffDate } from "@/components/staff/staff-date";

const field =
  "w-full rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";

export function WashFlow({
  warehouseStock,
  itemTypes,
}: {
  warehouseStock: StockRow[];
  itemTypes: ItemType[];
}) {
  const router = useRouter();
  const { backdateIso, resetToToday } = useStaffDate();

  const inputs = warehouseStock.filter((s) => s.qty > 0); // wash what's in the warehouse
  const outputs = itemTypes.filter((t) => t.isActive);

  const [lines, setLines] = useState<{ inputItemTypeId: number; outputItemTypeId: number; qty: string }[]>([
    { inputItemTypeId: inputs[0]?.itemTypeId ?? 0, outputItemTypeId: outputs[0]?.id ?? 0, qty: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLine = (
    i: number,
    patch: Partial<{ inputItemTypeId: number; outputItemTypeId: number; qty: string }>,
  ) => setLines((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const stockOf = (id: number) => inputs.find((s) => s.itemTypeId === id)?.qty ?? 0;

  async function submit() {
    const clean = lines
      .map((l) => ({
        inputItemTypeId: l.inputItemTypeId,
        outputItemTypeId: l.outputItemTypeId,
        qty: Math.max(0, Number(l.qty) || 0),
      }))
      .filter((l) => l.inputItemTypeId && l.outputItemTypeId && l.qty > 0);
    if (clean.length === 0) {
      setError(labels.wash.needSomething);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/wash", {
        lines: clean,
        notes: notes.trim() || undefined,
        occurredAt: backdateIso(),
      });
      resetToToday();
      router.push("/staff/washes?saved=1");
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
        <h1 className="text-lg font-bold">{labels.wash.title}</h1>
        <Link href="/staff/washes" className="rounded-lg border px-3 py-1.5 text-sm">
          {labels.wash.history}
        </Link>
      </div>

      {inputs.length === 0 ? (
        <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
          {labels.wash.noStock}
        </p>
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {labels.wash.inputItem}
                  <select
                    value={l.inputItemTypeId}
                    onChange={(e) => setLine(i, { inputItemTypeId: Number(e.target.value) })}
                    className={field}
                  >
                    {inputs.map((s) => (
                      <option key={s.itemTypeId} value={s.itemTypeId}>
                        {s.emoji ? `${s.emoji} ` : ""}
                        {s.labelMy} ({s.qty})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {labels.wash.outputItem}
                  <select
                    value={l.outputItemTypeId}
                    onChange={(e) => setLine(i, { outputItemTypeId: Number(e.target.value) })}
                    className={field}
                  >
                    {outputs.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.emoji ? `${t.emoji} ` : ""}
                        {t.labelMy}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
                  {labels.wash.qty}
                  {l.inputItemTypeId ? ` — ${stockOf(l.inputItemTypeId)}` : ""}
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={stockOf(l.inputItemTypeId)}
                    value={l.qty}
                    onChange={(e) => setLine(i, { qty: e.target.value })}
                    className={field + " tabular-nums"}
                  />
                </label>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}
                    className="justify-self-end rounded-lg border px-2 py-1 text-xs text-destructive sm:col-span-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() =>
                setLines((p) => [
                  ...p,
                  { inputItemTypeId: inputs[0]?.itemTypeId ?? 0, outputItemTypeId: outputs[0]?.id ?? 0, qty: "" },
                ])
              }
              className="self-start rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary"
            >
              + {labels.wash.addLine}
            </button>
          </section>

          <section className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
            <span className="text-sm font-medium">{labels.cut.note}</span>
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
                🧼 {submitting ? labels.common.saving : labels.common.save}
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
