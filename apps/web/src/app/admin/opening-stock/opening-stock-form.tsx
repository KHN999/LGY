"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";

interface Props {
  itemTypes: ItemType[];
}

interface DraftLine {
  itemTypeId: number;
  location: "WAREHOUSE" | "SHOP";
  qty: number;
  unitCost: string;
}

export function OpeningStockForm({ itemTypes }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>(
    itemTypes.length > 0
      ? [{ itemTypeId: itemTypes[0]!.id, location: "WAREHOUSE", qty: 0, unitCost: "" }]
      : [],
  );
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function remove(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    if (itemTypes.length === 0) return;
    setLines((prev) => [
      ...prev,
      { itemTypeId: itemTypes[0]!.id, location: "WAREHOUSE", qty: 0, unitCost: "" },
    ]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = lines.filter((l) => l.qty > 0);
    if (filled.length === 0) {
      setError("အရေအတွက်အနည်းဆုံး တစ်ခု ဖြည့်ပါ");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/opening-stock", {
        items: filled.map((l) => ({
          itemTypeId: l.itemTypeId,
          location: l.location,
          qty: l.qty,
          unitCost: l.unitCost.trim() ? Number(l.unitCost) : undefined,
        })),
        notes: notes.trim() || undefined,
      });
      router.push("/admin/opening-stock?saved=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  if (itemTypes.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-4 text-muted-foreground">
        {labels.admin.empty.itemTypes}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {lines.map((l, i) => (
          <li key={i} className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-end">
            <Field label={labels.admin.fields.itemTypeLabel}>
              <select
                value={l.itemTypeId}
                onChange={(ev) => update(i, { itemTypeId: Number(ev.target.value) })}
                className={inputClass}
              >
                {itemTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.emoji ? t.emoji + " " : ""}{t.labelMy}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={labels.admin.fields.location}>
              <select
                value={l.location}
                onChange={(ev) => update(i, { location: ev.target.value as "WAREHOUSE" | "SHOP" })}
                className={inputClass}
              >
                <option value="WAREHOUSE">{labels.transfer.locWarehouse}</option>
                <option value="SHOP">{labels.transfer.locShop}</option>
              </select>
            </Field>
            <Field label={labels.admin.fields.qty}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={l.qty}
                onChange={(ev) => update(i, { qty: Math.max(0, Number(ev.target.value) || 0) })}
                className={inputClass}
              />
            </Field>
            <Field label={labels.admin.fields.unitCost} hint={labels.common.optional}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={l.unitCost}
                onChange={(ev) => update(i, { unitCost: ev.target.value })}
                className={inputClass}
              />
            </Field>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-lg border px-3 py-2 text-sm text-destructive sm:self-end"
              >
                {labels.common.delete}
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" onClick={add} className="self-start rounded-lg border-2 border-dashed border-primary/40 px-4 py-2 text-sm text-primary">
        + {labels.common.addNew}
      </button>

      <Field label={labels.common.optional + " — " + labels.admin.fields.notes}>
        <textarea
          rows={2}
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-50"
      >
        {submitting ? labels.common.saving : labels.common.save}
      </button>
    </form>
  );
}
