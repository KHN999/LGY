"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type ItemType,
  type Location,
  type Driver,
  type ShopId,
} from "@/lib/api-client";
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

export function TransferFlow({ drivers, shopId }: { drivers: Driver[]; shopId: ShopId }) {
  const router = useRouter();
  const [from, setFrom] = useState<"WAREHOUSE" | "SHOP" | "IN_TRANSIT">("WAREHOUSE");
  const [to, setTo] = useState<"WAREHOUSE" | "SHOP" | "IN_TRANSIT">("SHOP");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [draft, setDraft] = useState<DraftLine | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverChoice, setDriverChoice] = useState("none"); // "none" | "<id>" | "other"
  const [driverFee, setDriverFee] = useState("");
  const [otherName, setOtherName] = useState("");

  function add(t: ItemType, stock: number) {
    setDraft({ itemType: t, qty: 0, stock });
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

  async function onSubmit(print: boolean) {
    if (lines.length === 0) {
      setError(labels.sell.noItems);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const fee = Math.max(0, Number(driverFee) || 0);
      const ev = await api.post<{ id: number }>("/transfers", {
        fromLocation: from,
        toLocation: to,
        items: lines.map((l) => ({ itemTypeId: l.itemType.id, qty: l.qty })),
        ...(fee > 0
          ? {
              driverFee: fee,
              ...(driverChoice === "other"
                ? { driverName: otherName.trim() || undefined }
                : driverChoice !== "none"
                  ? { driverId: Number(driverChoice) }
                  : {}),
            }
          : {}),
      });
      // Land on the printable transfer slip (also the history detail).
      router.push(`/staff/transfers/${ev.id}${print ? "?print=1" : ""}`);
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
    <main
      className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 sm:p-6"
      style={{ paddingBottom: "12rem" }}
    >
      <div className="flex items-center justify-between gap-2">
        <Link href="/staff" className="rounded-lg border px-3 py-2 text-sm">
          ← {labels.common.back}
        </Link>
        <h1 className="text-xl font-bold">{labels.transfer.title}</h1>
        <Link href="/staff/transfers" className="rounded-lg border px-3 py-2 text-sm">
          {labels.transfer.history}
        </Link>
      </div>

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

      <ItemTypeGrid
        locationForStock={from}
        hideZeroStock
        onPick={add}
        minStock={1}
        shopId={shopId}
      />

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

      {/* Delivery / driver (optional) — records a transport expense */}
      <section className="rounded-2xl border bg-card p-3">
        <p className="mb-2 text-sm font-medium">{labels.transfer.deliveryBy}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={driverChoice}
            onChange={(e) => setDriverChoice(e.target.value)}
            className="flex-1 rounded-lg border bg-background px-3 py-2 text-base"
          >
            <option value="none">{labels.transfer.noDriver}</option>
            {drivers.map((d) => (
              <option key={d.id} value={String(d.id)}>
                {d.name}
              </option>
            ))}
            <option value="other">{labels.transfer.otherDriver}</option>
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={driverFee}
            onChange={(e) => setDriverFee(e.target.value)}
            placeholder={labels.transfer.driverFee}
            className="w-full rounded-lg border bg-background px-3 py-2 text-base tabular-nums sm:w-32"
          />
        </div>
        {driverChoice === "other" && (
          <input
            type="text"
            maxLength={150}
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            placeholder={labels.transfer.otherDriver}
            className="mt-2 w-full rounded-lg border bg-background px-3 py-2 text-base"
          />
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
          {error}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-3 sm:p-4">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            type="button"
            onClick={() => onSubmit(false)}
            disabled={submitting || lines.length === 0 || from === to}
            className="flex-1 rounded-2xl border-2 border-emerald-600 py-4 text-lg font-bold text-emerald-700 disabled:opacity-50"
          >
            {submitting ? labels.common.saving : labels.common.save}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(true)}
            disabled={submitting || lines.length === 0 || from === to}
            className="flex-1 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow disabled:opacity-50"
          >
            🖨 {labels.transfer.savePrint}
          </button>
        </div>
      </div>
    </main>
  );
}
