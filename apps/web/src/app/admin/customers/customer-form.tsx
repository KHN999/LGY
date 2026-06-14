"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type Customer, type SaleKind } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button } from "@/components/ui";

interface Props {
  initial?: Customer;
}

type Status = "ACTIVE" | "INACTIVE";

export function CustomerForm({ initial }: Props) {
  const router = useRouter();
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [contact, setContact] = useState(initial?.contact ?? "");
  const [defaultKind, setDefaultKind] = useState<SaleKind>(
    initial?.defaultKind ?? "WHOLESALE",
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [status, setStatus] = useState<Status>(initial?.status ?? "ACTIVE");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [similar, setSimilar] = useState<{ id: number; name: string; contact: string | null }[]>(
    [],
  );

  // Warn (non-blocking) if a same/similar name already exists, so we don't pile
  // up "B-204 / B 204 / B204" duplicates. Normalized match, excludes self on edit.
  useEffect(() => {
    const q = name.trim();
    if (q.length < 2) {
      setSimilar([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const rows = await api.get<{ id: number; name: string; contact: string | null }[]>(
          `/customers/similar?name=${encodeURIComponent(q)}${initial?.id ? `&excludeId=${initial.id}` : ""}`,
        );
        setSimilar(rows);
      } catch {
        setSimilar([]);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [name, initial?.id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      contact: contact.trim() || undefined,
      defaultKind,
      notes: notes.trim() || undefined,
      status,
    };
    try {
      if (isEdit) {
        await api.patch(`/customers/${initial.id}`, body);
      } else {
        await api.post(`/customers`, body);
      }
      router.push("/admin/customers?saved=1");
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
      {similar.length > 0 && (
        <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-medium">{labels.customerDetail.similarExists}</p>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {similar.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="underline">
                  {c.name}
                  {c.contact ? ` (${c.contact})` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Field label={labels.admin.fields.contact}>
        <input maxLength={100} value={contact} onChange={(e) => setContact(e.target.value)} className={inputClass} />
      </Field>
      <Field label={labels.admin.fields.defaultKind}>
        <select
          value={defaultKind}
          onChange={(e) => setDefaultKind(e.target.value as SaleKind)}
          className={inputClass}
        >
          <option value="WHOLESALE">{labels.domain.wholesale}</option>
          <option value="RETAIL">{labels.domain.retail}</option>
        </select>
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
        <button type="button" onClick={() => router.push("/admin/customers")} className="rounded-lg border px-4 py-2">
          {labels.common.cancel}
        </button>
        <Button type="submit" size="lg" disabled={submitting || !name.trim()}>
          {submitting ? labels.common.saving : labels.common.save}
        </Button>
      </div>
    </form>
  );
}
