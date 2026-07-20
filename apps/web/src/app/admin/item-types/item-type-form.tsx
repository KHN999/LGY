"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button } from "@/components/ui";

interface Props {
  initial?: ItemType;
}

export function ItemTypeForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [key, setKey] = useState(initial?.key ?? "");
  const [labelMy, setLabelMy] = useState(initial?.labelMy ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [sortOrder, setSortOrder] = useState<string>(String(initial?.sortOrder ?? 0));
  const [costPrice, setCostPrice] = useState<string>(
    initial?.costPrice != null ? String(initial.costPrice) : "",
  );
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sellable, setSellable] = useState(initial?.sellable ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onDelete() {
    if (!initial) return;
    setError(null);
    setDeleting(true);
    try {
      await api.del(`/item-types/${initial.id}`);
      router.push("/admin/item-types?saved=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body = {
      key: key.trim(),
      labelMy: labelMy.trim(),
      // null (not undefined) so clearing the emoji actually persists — undefined is
      // dropped from the JSON body and the API's "update if defined" guard skips it.
      emoji: emoji.trim() || null,
      sortOrder: Number(sortOrder) || 0,
      isActive,
      sellable,
      // null (not 0) when blank so the item reads as "not costed" in valuation.
      costPrice: costPrice.trim() ? Math.max(0, Math.round(Number(costPrice) || 0)) : null,
    };
    try {
      if (isEdit) {
        await api.patch(`/item-types/${initial.id}`, body);
      } else {
        await api.post(`/item-types`, body);
      }
      router.push("/admin/item-types?saved=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <Field
        label={labels.admin.fields.itemTypeKey}
        hint="UPPER_SNAKE_CASE — once set, leave alone if possible"
      >
        <input
          required
          maxLength={50}
          value={key}
          disabled={isEdit}
          onChange={(e) => setKey(e.target.value.toUpperCase())}
          className={inputClass + (isEdit ? " bg-muted" : "")}
        />
      </Field>
      <Field label={labels.admin.fields.itemTypeLabel}>
        <input
          required
          maxLength={100}
          value={labelMy}
          onChange={(e) => setLabelMy(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={labels.admin.fields.itemTypeEmoji}>
        <input
          maxLength={20}
          value={emoji}
          onChange={(e) => setEmoji(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={labels.admin.fields.itemTypeSortOrder}>
        <input
          type="number"
          inputMode="numeric"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={labels.admin.costPrice}>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={costPrice}
          onChange={(e) => setCostPrice(e.target.value)}
          className={inputClass + " tabular-nums"}
        />
        {initial?.suggestedCost != null && (
          <button
            type="button"
            onClick={() => setCostPrice(String(initial.suggestedCost))}
            className="mt-1 text-left text-xs text-primary underline"
          >
            {labels.admin.suggestedCost}: {initial.suggestedCost.toLocaleString("en-US")}
          </button>
        )}
      </Field>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-5 w-5"
        />
        <span>{labels.admin.fields.itemTypeIsActive}</span>
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={sellable}
          onChange={(e) => setSellable(e.target.checked)}
          className="h-5 w-5"
        />
        <span>{labels.admin.fields.itemTypeSellable}</span>
      </label>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/item-types")}
          className="rounded-lg border px-4 py-2"
        >
          {labels.common.cancel}
        </button>
        <Button type="submit" size="lg" disabled={submitting || !key.trim() || !labelMy.trim()}>
          {submitting ? labels.common.saving : labels.common.save}
        </Button>
      </div>

      {isEdit && (
        <div className="mt-2 border-t pt-4">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
            >
              🗑 {labels.common.delete}
            </button>
          ) : (
            <div className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
              <p className="text-sm">{labels.admin.fields.itemTypeDeleteConfirm}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting}
                  className="rounded-lg border px-4 py-2 text-sm"
                >
                  {labels.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={deleting}
                  className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
                >
                  {deleting ? labels.common.loading : labels.common.delete}
                </button>
              </div>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">{labels.admin.fields.itemTypeDeleteHint}</p>
        </div>
      )}
    </form>
  );
}
