"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ShopSettings } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { Receipt, type ReceiptData } from "@/components/staff/receipt";

/** Static sample so the admin sees exactly how their text lands on the receipt. */
const SAMPLE: ReceiptData = {
  saleId: 1234,
  date: "2026-01-01T10:30:00",
  customerName: "Daw Mya",
  lines: [
    { label: "🧵 Acheik", qty: 2, unitPrice: 12000, lineTotal: 24000 },
    { label: "Cotton longyi", qty: 1, unitPrice: 8000, lineTotal: 8000 },
  ],
  grandTotal: 32000,
  paid: 30000,
};

export function SettingsForm({ initial }: { initial: ShopSettings }) {
  const router = useRouter();
  const [form, setForm] = useState({
    shopName: initial.shopName ?? "",
    addressLine: initial.addressLine ?? "",
    phone: initial.phone ?? "",
    social: initial.social ?? "",
    receiptHeader: initial.receiptHeader ?? "",
    receiptFooter: initial.receiptFooter ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((p) => ({ ...p, [key]: value }));
    setSavedAt(false);
  }

  // What the preview/receipt actually uses (empty → fall back to defaults).
  const preview: ShopSettings = {
    shopName: form.shopName.trim() || initial.shopName,
    addressLine: form.addressLine.trim() || null,
    phone: form.phone.trim() || null,
    social: form.social.trim() || null,
    receiptHeader: form.receiptHeader.trim() || null,
    receiptFooter: form.receiptFooter.trim() || null,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.patch("/settings", {
        shopName: form.shopName.trim(),
        addressLine: form.addressLine,
        phone: form.phone,
        social: form.social,
        receiptHeader: form.receiptHeader,
        receiptFooter: form.receiptFooter,
      });
      setSavedAt(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border bg-card p-5">
        <Field label={labels.settings.shopName}>
          <input
            type="text"
            value={form.shopName}
            onChange={(e) => set("shopName", e.target.value)}
            maxLength={120}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label={labels.settings.receiptHeader}>
          <input
            type="text"
            value={form.receiptHeader}
            onChange={(e) => set("receiptHeader", e.target.value)}
            maxLength={200}
            placeholder={labels.receipt.title}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label={labels.settings.address}>
          <input
            type="text"
            value={form.addressLine}
            onChange={(e) => set("addressLine", e.target.value)}
            maxLength={200}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label={labels.settings.phone}>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
            maxLength={60}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label={labels.settings.social}>
          <input
            type="text"
            value={form.social}
            onChange={(e) => set("social", e.target.value)}
            maxLength={120}
            placeholder={labels.settings.socialPlaceholder}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label={labels.settings.receiptFooter}>
          <textarea
            value={form.receiptFooter}
            onChange={(e) => set("receiptFooter", e.target.value)}
            maxLength={300}
            rows={3}
            placeholder={labels.receipt.thanks}
            className="w-full rounded-lg border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? labels.common.saving : labels.common.save}
          </button>
          {savedAt && <span className="text-sm text-emerald-600">✓ {labels.settings.saved}</span>}
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">{labels.settings.preview}</p>
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <Receipt data={SAMPLE} shop={preview} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}
