"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError, type ShopId, type ShopInfo } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ShopSwitchButton } from "@/components/shop/shop-switch-button";
import { shopName } from "@/components/shop/shop-name";

const L = labels.shop;
const OPTIONS = ["itemTypes", "customers", "suppliers", "tailors", "drivers", "employees", "settings"] as const;
type Opt = (typeof OPTIONS)[number];
// What each ticked option copied, by the table name the API reports.
const TABLE: Record<Opt, string> = {
  itemTypes: "ItemType",
  customers: "Customer",
  suppliers: "Supplier",
  tailors: "Tailor",
  drivers: "Driver",
  employees: "Employee",
  settings: "ShopSetting",
};

interface Created {
  key: ShopId;
  name: string;
  copied: Record<string, number>;
}

export function ShopsManager({
  current,
  shops,
  ready,
  notReadyReason,
}: {
  current: ShopId;
  shops: ShopInfo[];
  ready: boolean;
  notReadyReason?: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  // Everything ticked by default: people and products come along, history doesn't.
  const [pick, setPick] = useState<Record<Opt, boolean>>(
    () => Object.fromEntries(OPTIONS.map((o) => [o, true])) as Record<Opt, boolean>,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const from = shopName(current, shops);

  async function create() {
    const clean = name.trim();
    if (!clean) return;
    if (!confirm(L.confirm(clean, from))) return;
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<Created>("/shop/create", { name: clean, ...pick });
      setCreated(res);
      setName("");
      router.refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">{L.listTitle}</h2>
        <ul className="flex flex-col divide-y rounded-2xl border bg-card">
          {shops.map((s) => (
            <li key={s.key} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-semibold">
                  {s.sandbox ? "🧪" : "🏬"} {shopName(s.key, shops)}
                  {s.sandbox && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      {L.sandboxTag}
                    </span>
                  )}
                </p>
              </div>
              {s.key === current ? (
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-900">
                  ✓ {L.youAreHere}
                </span>
              ) : (
                <ShopSwitchButton to={s.key} home="/admin" className="rounded-lg border px-3 py-1.5 text-sm hover:bg-accent">
                  {L.go} →
                </ShopSwitchButton>
              )}
            </li>
          ))}
        </ul>
      </section>

      {created && (
        <section className="flex flex-col gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950">
          <p className="text-base font-bold">✓ {L.created(created.name)}</p>
          <p className="text-sm">
            {L.copied}:{" "}
            {OPTIONS.filter((o) => created.copied[TABLE[o]] !== undefined)
              .map((o) => `${L.opt[o].split(" (")[0]} ${created.copied[TABLE[o]]}`)
              .join(" · ") || "—"}
          </p>
          <p className="text-sm leading-relaxed">{L.afterNote}</p>
          <ShopSwitchButton
            to={created.key}
            home="/admin"
            className="self-start rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {L.go} →
          </ShopSwitchButton>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4">
        <div>
          <h2 className="text-base font-semibold">{L.createTitle}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{L.createIntro(from)}</p>
        </div>

        {!ready && (
          <p role="alert" className="rounded-lg bg-amber-100 p-3 text-sm text-amber-900">
            {L.notReady} {notReadyReason ? `(${notReadyReason})` : ""}
          </p>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{L.name}</span>
          <input
            id="shop-name"
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder={L.namePlaceholder}
            className="w-full max-w-md rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{L.carry}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((o) => (
              <label key={o} className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50">
                <input
                  id={`carry-${o}`}
                  type="checkbox"
                  className="h-5 w-5"
                  checked={pick[o]}
                  onChange={(e) => setPick((p) => ({ ...p, [o]: e.target.checked }))}
                />
                {L.opt[o]}
              </label>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">{L.always}</p>
          <p className="text-xs leading-relaxed text-muted-foreground">{L.never}</p>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={create}
          disabled={busy || !ready || !name.trim()}
          className="self-start rounded-xl bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          🏬 {busy ? L.creating : L.create}
        </button>
      </section>
    </div>
  );
}
