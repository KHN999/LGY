"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Supplier, type ItemType, type SupplierOrder } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button } from "@/components/ui";

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
  const [expectedYards, setExpectedYards] = useState<string>(
    initial?.expectedYards != null ? String(initial.expectedYards) : "",
  );
  const [pricePerYard, setPricePerYard] = useState<string>(
    initial?.pricePerYard != null ? String(initial.pricePerYard) : "",
  );
  const [expectedTotal, setExpectedTotal] = useState<string>(
    String(initial?.expectedTotal ?? ""),
  );
  const [orderDate, setOrderDate] = useState<string>(
    initial?.orderDate ? initial.orderDate.slice(0, 10) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Total auto-fills from yards × price/yard (still editable to override).
  function recalcTotal(y: string, p: string) {
    const t = (Number(y) || 0) * (Number(p) || 0);
    if (t > 0) setExpectedTotal(String(t));
  }
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
      expectedYards: expectedYards ? Number(expectedYards) : undefined,
      pricePerYard: pricePerYard ? Number(pricePerYard) : undefined,
      expectedTotal: Number(expectedTotal),
      // Date-only → noon Yangon so it displays on the chosen day; blank = today.
      orderDate: orderDate ? new Date(`${orderDate}T12:00:00+06:30`).toISOString() : undefined,
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
        <Field label={labels.admin.order.orderDate}>
          <input
            type="date"
            value={orderDate}
            onChange={(e) => setOrderDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={labels.admin.order.yards}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={expectedYards}
            onChange={(e) => {
              setExpectedYards(e.target.value);
              recalcTotal(e.target.value, pricePerYard);
            }}
            className={inputClass}
          />
        </Field>
        <Field label={labels.admin.order.pricePerYard + " (" + labels.units.kyat + ")"}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={pricePerYard}
            onChange={(e) => {
              setPricePerYard(e.target.value);
              recalcTotal(expectedYards, e.target.value);
            }}
            className={inputClass}
          />
        </Field>
        <Field
          label={labels.admin.order.totalExpected + " (" + labels.units.kyat + ")"}
          hint={labels.admin.order.totalHint}
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
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? labels.common.saving : labels.common.save}
        </Button>
      </div>
    </form>
  );
}
