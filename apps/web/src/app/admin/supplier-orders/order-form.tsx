"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Supplier, type ItemType, type SupplierOrder } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";

interface Props {
  suppliers: Supplier[];
  itemTypes: ItemType[];
  initial?: SupplierOrder;
}

export function OrderForm({ suppliers, itemTypes, initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [supplierId, setSupplierId] = useState<string>(
    String(initial?.supplierId ?? suppliers[0]?.id ?? ""),
  );
  const [itemTypeId, setItemTypeId] = useState<string>(
    String(initial?.itemTypeId ?? itemTypes[0]?.id ?? ""),
  );
  const [expectedQty, setExpectedQty] = useState<string>(
    String(initial?.expectedQty ?? ""),
  );
  const [expectedTotal, setExpectedTotal] = useState<string>(
    String(initial?.expectedTotal ?? ""),
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body = {
      supplierId: Number(supplierId),
      itemTypeId: Number(itemTypeId),
      expectedQty: Number(expectedQty),
      expectedTotal: Number(expectedTotal),
      notes: notes.trim() || undefined,
    };
    try {
      let id = initial?.id;
      if (isEdit) {
        await api.patch(`/supplier-orders/${initial.id}`, body);
      } else {
        const created = await api.post<SupplierOrder>(`/supplier-orders`, body);
        id = created.id;
      }
      router.push(`/admin/supplier-orders/${id}?saved=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  if (suppliers.length === 0 || itemTypes.length === 0) {
    return (
      <p className="rounded-lg border bg-card p-4 text-muted-foreground">
        {suppliers.length === 0
          ? labels.admin.empty.suppliers
          : labels.admin.empty.itemTypes}
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label={labels.domain.supplier}>
        <select
          value={supplierId}
          onChange={(e) => setSupplierId(e.target.value)}
          className={inputClass}
          required
        >
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={labels.domain.itemType}>
        <select
          value={itemTypeId}
          onChange={(e) => setItemTypeId(e.target.value)}
          className={inputClass}
          required
        >
          {itemTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.emoji ? t.emoji + " " : ""}{t.labelMy}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={labels.admin.order.expectedQty}>
          <input
            required
            type="number"
            inputMode="numeric"
            min={1}
            value={expectedQty}
            onChange={(e) => setExpectedQty(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field
          label={labels.admin.order.totalExpected + " (" + labels.units.kyat + ")"}
          hint="တစ်ခုချင်းမတွက်ဘဲ စုစုပေါင်းပိုက်ဆံ"
        >
          <input
            required
            type="number"
            inputMode="numeric"
            min={0}
            value={expectedTotal}
            onChange={(e) => setExpectedTotal(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label={labels.admin.fields.notes}>
        <textarea
          rows={3}
          maxLength={1000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/supplier-orders")}
          className="rounded-lg border px-4 py-2"
        >
          {labels.common.cancel}
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? labels.common.saving : labels.common.save}
        </button>
      </div>
    </form>
  );
}
