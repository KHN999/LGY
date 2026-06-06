"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api-client";
import { labels } from "@/lib/labels";

// Contact Picker API (Android Chrome) — not in the TS DOM lib, so declare what we use.
interface PickedContact {
  name?: string[];
  tel?: string[];
}
interface ContactsManager {
  select: (props: string[], opts?: { multiple?: boolean }) => Promise<PickedContact[]>;
}

/**
 * One-tap import from the phone's address book via the native Contact Picker.
 * Works on Android Chrome; on other browsers it explains where to use it.
 * Duplicates are skipped server-side (by phone, or name when no phone).
 */
export function ImportContacts() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setMsg(null);
    const cm = (navigator as Navigator & { contacts?: ContactsManager }).contacts;
    if (!cm || typeof cm.select !== "function") {
      setError(labels.admin.importUnsupported);
      return;
    }
    setBusy(true);
    try {
      const picked = await cm.select(["name", "tel"], { multiple: true });
      const contacts = picked
        .map((c) => ({ name: c.name?.[0]?.trim() ?? "", contact: c.tel?.[0]?.trim() || undefined }))
        .filter((c) => c.name);
      if (contacts.length === 0) return;
      const res = await api.post<{ created: number; skipped: number }>("/customers/import", {
        contacts,
      });
      setMsg(labels.admin.importResult(res.created, res.skipped));
      router.refresh();
    } catch (err) {
      // Cancelling the picker rejects with AbortError — that's not an error.
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="self-start rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        📇 {busy ? labels.common.loading : labels.admin.importContacts}
      </button>
      {msg && (
        <p className="rounded-lg bg-emerald-100 px-3 py-2 text-sm text-emerald-900">{msg}</p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
