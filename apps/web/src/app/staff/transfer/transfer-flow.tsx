"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, ApiError, type ItemType, type Location } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { ItemTypeGrid } from "@/components/staff/item-type-grid";
import { QtyStepper } from "@/components/staff/qty-stepper";

interface DraftLine {
  itemType: ItemType;
  qty: number;
  stock: number;
}

const LOC_LABEL: Record<"WAREHOUSE" | "SHOP" | "IN_TRANSIT", string> = {
  WAREHOUSE: labels.transfer.locWarehouse,
  SHOP: labels.transfer.locShop,
  IN_TRANSIT: labels.transfer.locInTransit,
};

export function TransferFlow() {
  const router = useRouter();
  const [from, setFrom] = useState<"WAREHOUSE" | "SHOP" | "IN_TRANSIT">("WAREHOUSE");
  const [to, setTo] = useState<"WAREHOUSE" | "SHOP" | "IN_TRANSIT">("SHOP");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function add(t: ItemType, stock: number) {
    setDraft({ itemType: t, qty: 1, stock });
  }
  function commit() {
    if (!draft) return;
    if (draft.qty <= 0 || draft.qty > draft.stock) {
      setError(labels.transfer.notEnough);
      return;
    }
    setError(null);
    setLines((prev) => [...prev, draft]);
    setDraft(null);
  }
  function remove(i: number) {
    setLines((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function onSubmit() {
    if (lines.length === 0) {
      setError(labels.sell.noItems);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/transfers", {
        fromLocation: from,
        toLocation: to,
        items: lines.map((l) => ({ itemTypeId: l.itemType.id, qty: l.qty })),
      });
      router.push("/staff?saved=transfer");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  if (draft) {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setDraft(null)}
          className="self-start rounded-lg border px-4 py-2"
        >
          ← {labels.common.back}
        </button>
        <div className="rounded-2xl border bg-card p-4 text-center">
          <span className="text-5xl">{draft.itemType.emoji}</span>
          <h2 className="mt-2 text-xl font-bold">{draft.itemType.labelMy}</h2>
          <p className="text-xs text-muted-foreground">
            {LOC_LABEL[from]} {labels.sell.inStock}: {draft.stock}
          </p>
        </div>
        <p className="text-center text-base text-muted-foreground">{labels.sell.chooseQty}</p>
        <QtyStepper
          value={draft.qty}
          max={draft.stock}
          onChange={(qty) => setDraft({ ...draft, qty })}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={commit}
          disabled={draft.qty <= 0}
          className="rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white shadow-lg disabled:opacity-50"
        >
          {labels.common.add}
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-32 sm:p-6">
      <Link href="/staff" className="self-start rounded-lg border px-4 py-2">
        ← {labels.common.back}
      </Link>
      <h1 className="text-center text-xl font-bold">{labels.transfer.title}</h1>

      <div className="rounded-2xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{labels.transfer.fromLocation}</p>
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value as Location)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-base"
            >
              <option value="WAREHOUSE">{labels.transfer.locWarehouse}</option>
              <option value="SHOP">{labels.transfer.locShop}</option>
              <option value="IN_TRANSIT">{labels.transfer.locInTransit}</option>
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{labels.transfer.toLocation}</p>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value as Location)}
              className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-base"
            >
              <option value="WAREHOUSE">{labels.transfer.locWarehouse}</option>
              <option value="SHOP">{labels.transfer.locShop}</option>
              <option value="IN_TRANSIT">{labels.transfer.locInTransit}</option>
            </select>
          </div>
        </div>
      </div>

      <ItemTypeGrid locationForStock={from} hideZeroStock onPick={add} minStock={1} />

      {lines.length > 0 && (
        <section className="rounded-2xl border bg-card p-3">
          <ul className="flex flex-col divide-y">
            {lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>
                  {l.itemType.emoji} {l.itemType.labelMy} × {l.qty}
                </span>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="rounded-lg border px-3 py-1 text-xs text-destructive"
                >
                  {labels.sell.removeLine}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting || lines.length === 0 || from === to}
            className="flex-1 rounded-2xl bg-emerald-600 py-5 text-2xl font-bold text-white shadow disabled:opacity-50"
          >
            {submitting ? labels.common.saving : labels.common.save}
          </button>
        </div>
      </div>
    </main>
  );
}
