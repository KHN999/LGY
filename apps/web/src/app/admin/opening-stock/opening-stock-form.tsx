"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button } from "@/components/ui";

interface Props {
  itemTypes: ItemType[];
}

interface DraftLine {
  itemTypeId: number;
  location: "WAREHOUSE" | "SHOP";
  // Kept as a string (like unitCost) so the field can be cleared to empty
  // instead of being pinned to "0"; parsed to a number on submit.
  qty: string;
  unitCost: string;
}

export function OpeningStockForm({ itemTypes }: Props) {
  const router = useRouter();
  const [lines, setLines] = useState<DraftLine[]>(
    itemTypes.length > 0
      ? [{ itemTypeId: itemTypes[0]!.id, location: "WAREHOUSE", qty: "", unitCost: "" }]
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
      { itemTypeId: itemTypes[0]!.id, location: "WAREHOUSE", qty: "", unitCost: "" },
    ]);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const filled = lines.filter((l) => Number(l.qty) > 0);
    if (filled.length === 0) {
      setError(labels.admin.atLeastOneQty);
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/opening-stock", {
        items: filled.map((l) => ({
          itemTypeId: l.itemTypeId,
          location: l.location,
          qty: Number(l.qty),
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
          <li key={i} className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:flex-row sm:items-start">
            <Field label={labels.admin.fields.itemTypeLabel}>
              <select
                value={l.itemTypeId}
                onChange={(ev) => update(i, { itemTypeId: Number(ev.target.value) })}
                className={inputClass + " h-11"}
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
                className={inputClass + " h-11"}
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
                placeholder="0"
                value={l.qty}
                onChange={(ev) => update(i, { qty: ev.target.value })}
                className={inputClass + " h-11"}
              />
            </Field>
            <Field label={labels.admin.fields.unitCost} hint={labels.common.optional}>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={l.unitCost}
                onChange={(ev) => update(i, { unitCost: ev.target.value })}
                className={inputClass + " h-11"}
              />
            </Field>
            {lines.length > 1 && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded-lg border px-3 py-2 text-sm text-destructive h-11 sm:mt-[26px]"
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

      <Button type="submit" size="lg" disabled={submitting} className="self-start">
        {submitting ? labels.common.saving : labels.common.save}
      </Button>
    </form>
  );
}
