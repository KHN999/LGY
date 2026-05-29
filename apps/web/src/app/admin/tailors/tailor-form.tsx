"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type Tailor } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";

interface Props { initial?: Tailor; }
type Status = "ACTIVE" | "INACTIVE";

export function TailorForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [defaultFeePerPiece, setDefaultFeePerPiece] = useState<string>(
    initial?.defaultFeePerPiece != null ? String(initial.defaultFeePerPiece) : "",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      contact: contact.trim() || undefined,
      notes: notes.trim() || undefined,
      status,
    };
    if (defaultFeePerPiece.trim()) body.defaultFeePerPiece = Number(defaultFeePerPiece);
    try {
      if (isEdit) await api.patch(`/tailors/${initial.id}`, body);
      else await api.post(`/tailors`, body);
      router.push("/admin/tailors?saved=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      <Field label={labels.admin.fields.name}>
        <input required maxLength={150} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </Field>
      <Field label={labels.admin.fields.contact}>
        <input maxLength={100} value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
      </Field>
      <Field label={labels.admin.fields.defaultFeePerPiece}>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={defaultFeePerPiece}
          onChange={(e) => setDefaultFeePerPiece(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={labels.admin.fields.notes}>
        <textarea rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </Field>
      <Field label={labels.admin.fields.status}>
        <select value={status} onChange={(e) => setStatus(e.target.value as Status)} className={inputClass}>
          <option value="ACTIVE">{labels.admin.actions.active}</option>
          <option value="INACTIVE">{labels.admin.actions.inactive}</option>
        </select>
      </Field>
      {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={() => router.push("/admin/tailors")} className="rounded-lg border px-4 py-2">{labels.common.cancel}</button>
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-lg bg-primary px-6 py-2 font-semibold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? labels.common.saving : labels.common.save}
        </button>
      </div>
    </form>
  );
}
