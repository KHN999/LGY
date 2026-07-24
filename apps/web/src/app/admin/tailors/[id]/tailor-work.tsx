"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type TailorDetail,
  type StockRow,
  type ItemType,
} from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { inputClass } from "@/components/admin/form-field";
import { Button, Card } from "@/components/ui";

export function TailorWork({
  tailor,
  warehouseStock,
  itemTypes,
}: {
  tailor: TailorDetail;
  warehouseStock: StockRow[];
  itemTypes: ItemType[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"none" | "send" | "receive">("none");
  const [error, setError] = useState<string | null>(null);
  const onSaved = (eventId: number, print: boolean) =>
    router.push(`/admin/tailors/${tailor.id}/jobs/${eventId}${print ? "?print=1" : ""}`);

  const available = warehouseStock.filter((s) => s.qty > 0);
  const outputs = itemTypes.filter((t) => t.isActive);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">{labels.tailorWork.inHand}</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={mode === "send" ? "primary" : "outline"}
            onClick={() => setMode((m) => (m === "send" ? "none" : "send"))}
          >
            {labels.tailorWork.send}
          </Button>
          <Button
            size="sm"
            variant={mode === "receive" ? "primary" : "outline"}
            onClick={() => setMode((m) => (m === "receive" ? "none" : "receive"))}
          >
            {labels.tailorWork.receive}
          </Button>
        </div>
      </div>

      {tailor.holdings.length === 0 ? (
        <p className="text-sm text-muted-foreground">{labels.tailorWork.nothing}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {tailor.holdings.map((h) => (
            <li key={h.itemTypeId} className="rounded-full bg-muted px-3 py-1 text-sm">
              {h.emoji ?? ""} {h.labelMy} × <span className="font-semibold tabular-nums">{h.qty}</span>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {mode === "send" && (
        <SendForm
          tailorId={tailor.id}
          available={available}
          onClose={() => setMode("none")}
          onError={setError}
          onSaved={onSaved}
        />
      )}
      {mode === "receive" && (
        <ReceiveForm
          tailor={tailor}
          outputs={outputs}
          onClose={() => setMode("none")}
          onError={setError}
          onSaved={onSaved}
        />
      )}
    </Card>
  );
}

// ── Send ────────────────────────────────────────────────────────────
function SendForm({
  tailorId,
  available,
  onClose,
  onError,
  onSaved,
}: {
  tailorId: number;
  available: StockRow[];
  onClose: () => void;
  onError: (m: string) => void;
  onSaved: (eventId: number, print: boolean) => void;
}) {
  const first = available[0]?.itemTypeId ?? 0;
  const [rows, setRows] = useState([{ itemTypeId: first, qty: "" }]);
  // Materials consumed on send (e.g. အထက်ဆင်) — deducted from warehouse, not held.
  const [mats, setMats] = useState<{ itemTypeId: number; qty: string }[]>([]);
  const [date, setDate] = useState(""); // optional backdate (YYYY-MM-DD); blank = now
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) =>
    setRows((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const setMat = (i: number, patch: Partial<{ itemTypeId: number; qty: string }>) =>
    setMats((p) => p.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  async function submit(print: boolean) {
    const items = rows
      .map((r) => ({ itemTypeId: r.itemTypeId, qty: Math.max(0, Number(r.qty) || 0) }))
      .filter((it) => it.itemTypeId && it.qty > 0);
    if (items.length === 0) {
      onError(labels.errors.required);
      return;
    }
    const consumed = mats
      .map((r) => ({ itemTypeId: r.itemTypeId, qty: Math.max(0, Number(r.qty) || 0) }))
      .filter((m) => m.itemTypeId && m.qty > 0);
    setBusy(true);
    try {
      const ev = await api.post<{ id: number }>(`/tailors/${tailorId}/send`, {
        items,
        ...(consumed.length ? { consumed } : {}),
        occurredAt: date || undefined,
      });
      onSaved(ev.id, print);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (available.length === 0) {
    return (
      <p className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
        {labels.common.noData}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="flex flex-col gap-2 rounded-xl border bg-background p-3"
    >
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {labels.tailorWork.date}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass + " w-44"}
        />
      </label>
      <p className="text-xs font-semibold text-muted-foreground">{labels.tailorWork.sendPieces}</p>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.itemTypeId}
            onChange={(e) => setRow(i, { itemTypeId: Number(e.target.value) })}
            className={inputClass + " min-w-0 flex-1"}
          >
            {available.map((s) => (
              <option key={s.itemTypeId} value={s.itemTypeId}>
                {s.labelMy} ({s.qty})
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={r.qty}
            onChange={(e) => setRow(i, { qty: e.target.value })}
            placeholder={labels.tailorWork.qty}
            className={inputClass + " w-24 text-right"}
          />
          {rows.length > 1 && (
            <button
              type="button"
              onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
              className="rounded-lg border px-2 py-1 text-xs text-destructive"
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows((p) => [...p, { itemTypeId: first, qty: "" }])}
        className="self-start rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary"
      >
        + {labels.tailorWork.addItem}
      </button>

      {/* Materials consumed on send (deducted from warehouse, not held) */}
      <p className="mt-2 text-xs font-semibold text-muted-foreground">{labels.tailorWork.materials}</p>
      <p className="-mt-1 text-xs text-muted-foreground">{labels.tailorWork.materialsHint}</p>
      {mats.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={r.itemTypeId}
            onChange={(e) => setMat(i, { itemTypeId: Number(e.target.value) })}
            className={inputClass + " min-w-0 flex-1"}
          >
            {available.map((s) => (
              <option key={s.itemTypeId} value={s.itemTypeId}>
                {s.labelMy} ({s.qty})
              </option>
            ))}
          </select>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={r.qty}
            onChange={(e) => setMat(i, { qty: e.target.value })}
            placeholder={labels.tailorWork.qty}
            className={inputClass + " w-24 text-right"}
          />
          <button
            type="button"
            onClick={() => setMats((p) => p.filter((_, idx) => idx !== i))}
            className="rounded-lg border px-2 py-1 text-xs text-destructive"
          >
            ✕
          </button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMats((p) => [...p, { itemTypeId: first, qty: "" }])}
          className="rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary"
        >
          + {labels.tailorWork.addMaterial}
        </button>
        <div className="flex-1" />
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          {labels.common.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? labels.common.saving : labels.common.save}
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => submit(true)}>
          🖨 {labels.tailorWork.savePrint}
        </Button>
      </div>
    </form>
  );
}

// ── Receive ─────────────────────────────────────────────────────────
function ReceiveForm({
  tailor,
  outputs,
  onClose,
  onError,
  onSaved,
}: {
  tailor: TailorDetail;
  outputs: ItemType[];
  onClose: () => void;
  onError: (m: string) => void;
  onSaved: (eventId: number, print: boolean) => void;
}) {
  const holdings = tailor.holdings;
  const firstIn = holdings[0]?.itemTypeId ?? 0;
  const firstOut = outputs[0]?.id ?? firstIn;
  const [rows, setRows] = useState([
    { inputItemTypeId: firstIn, sentQty: "", outputItemTypeId: firstOut, receivedQty: "" },
  ]);
  const [fee, setFee] = useState("");
  const [feeDirty, setFeeDirty] = useState(false);
  const [date, setDate] = useState(""); // optional backdate (YYYY-MM-DD); blank = now
  const [busy, setBusy] = useState(false);

  function setRow(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((prev) => {
      const next = prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
      if (!feeDirty) {
        const tot = next.reduce((s, r) => s + (Number(r.receivedQty) || 0), 0);
        setFee(tot > 0 ? String(tot * (tailor.defaultFeePerPiece ?? 0)) : "");
      }
      return next;
    });
  }

  async function submit(print: boolean) {
    const lines = rows
      .map((r) => ({
        inputItemTypeId: r.inputItemTypeId,
        sentQty: Math.max(0, Number(r.sentQty) || 0),
        outputItemTypeId: r.outputItemTypeId,
        receivedQty: Math.max(0, Number(r.receivedQty) || 0),
      }))
      .filter((l) => l.inputItemTypeId && l.outputItemTypeId && l.sentQty > 0);
    if (lines.length === 0) {
      onError(labels.errors.required);
      return;
    }
    if (lines.some((l) => l.receivedQty > l.sentQty)) {
      onError(labels.tailorWork.receivedTooMany);
      return;
    }
    setBusy(true);
    try {
      const ev = await api.post<{ id: number }>(`/tailors/${tailor.id}/receive`, {
        lines,
        fee: Math.max(0, Number(fee) || 0),
        occurredAt: date || undefined,
      });
      onSaved(ev.id, print);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  if (holdings.length === 0) {
    return (
      <p className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
        {labels.tailorWork.nothing}
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(false);
      }}
      className="flex flex-col gap-3 rounded-xl border bg-background p-3"
    >
      <label className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {labels.tailorWork.date}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass + " w-44"}
        />
      </label>
      {rows.map((r, i) => {
        const loss = Math.max(0, (Number(r.sentQty) || 0) - (Number(r.receivedQty) || 0));
        return (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border p-2">
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
              {labels.tailorWork.inputItem}
              <select
                value={r.inputItemTypeId}
                onChange={(e) => setRow(i, { inputItemTypeId: Number(e.target.value) })}
                className={inputClass}
              >
                {holdings.map((h) => (
                  <option key={h.itemTypeId} value={h.itemTypeId}>
                    {h.labelMy} ({h.qty})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
              {labels.tailorWork.sentQty}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={r.sentQty}
                onChange={(e) => setRow(i, { sentQty: e.target.value })}
                className={inputClass + " text-right"}
              />
            </label>
            <label className="col-span-2 flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
              {labels.tailorWork.outputItem}
              <select
                value={r.outputItemTypeId}
                onChange={(e) => setRow(i, { outputItemTypeId: Number(e.target.value) })}
                className={inputClass}
              >
                {outputs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.labelMy}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-1">
              {labels.tailorWork.receivedQty}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={r.receivedQty}
                onChange={(e) => setRow(i, { receivedQty: e.target.value })}
                className={inputClass + " text-right"}
              />
            </label>
            <div className="col-span-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {labels.tailorWork.loss}: {loss}
              </span>
              {rows.length > 1 && (
                <button
                  type="button"
                  onClick={() => setRows((p) => p.filter((_, idx) => idx !== i))}
                  className="rounded-lg border px-2 py-1 text-xs text-destructive"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() =>
          setRows((p) => [
            ...p,
            { inputItemTypeId: firstIn, sentQty: "", outputItemTypeId: firstOut, receivedQty: "" },
          ])
        }
        className="self-start rounded-lg border-2 border-dashed border-primary/40 px-3 py-1.5 text-sm text-primary"
      >
        + {labels.tailorWork.addLine}
      </button>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{labels.tailorWork.fee}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={fee}
          onChange={(e) => {
            setFee(e.target.value);
            setFeeDirty(true);
          }}
          className={inputClass + " tabular-nums"}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onClose}>
          {labels.common.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={busy} className="flex-1">
          {busy ? labels.common.saving : labels.common.save}
        </Button>
        <Button type="button" size="sm" disabled={busy} onClick={() => submit(true)}>
          🖨 {labels.tailorWork.savePrint}
        </Button>
      </div>
    </form>
  );
}
