"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ItemType } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";

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
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body = {
      key: key.trim(),
      labelMy: labelMy.trim(),
      emoji: emoji.trim() || undefined,
      sortOrder: Number(sortOrder) || 0,
      isActive,
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
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-5 w-5"
        />
        <span>{labels.admin.fields.itemTypeIsActive}</span>
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
        <button
          type="submit"
          disabled={submitting || !key.trim() || !labelMy.trim()}
          className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? labels.common.saving : labels.common.save}
        </button>
      </div>
    </form>
  );
}
