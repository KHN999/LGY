"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type TailorDetail,
  type TailorCharge,
  type TailorPaymentRow,
} from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button, Card } from "@/components/ui";

const METHODS: { value: string; label: string }[] = [
  { value: "CASH", label: labels.tailorLedger.methodCash },
  { value: "BANK_TRANSFER", label: labels.tailorLedger.methodBank },
  { value: "MOBILE_MONEY", label: labels.tailorLedger.methodMobile },
  { value: "OTHER", label: labels.tailorLedger.methodOther },
];
const methodLabel = (m: string) => METHODS.find((x) => x.value === m)?.label ?? m;
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB");

export function TailorLedger({ tailor }: { tailor: TailorDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const refresh = () => router.refresh();

  const tone =
    tailor.balance > 0 ? "text-rose-600" : tailor.balance < 0 ? "text-emerald-600" : "";
  const balLabel =
    tailor.balance > 0
      ? labels.tailorLedger.owe
      : tailor.balance < 0
        ? labels.tailorLedger.credit
        : labels.tailorLedger.settled;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between p-4">
        <span className="text-sm text-muted-foreground">{balLabel}</span>
        <span className={"text-2xl font-bold tabular-nums " + tone}>
          {formatKyat(Math.abs(tailor.balance))}
        </span>
      </Card>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ChargesSection tailor={tailor} onError={setError} onDone={refresh} />
      <PaymentsSection tailor={tailor} onError={setError} onDone={refresh} />
    </div>
  );
}

// ── Charges ─────────────────────────────────────────────────────────
function ChargesSection({
  tailor,
  onError,
  onDone,
}: {
  tailor: TailorDetail;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{labels.tailorLedger.charges}</h2>
        <Button type="button" size="sm" onClick={() => setAdding((v) => !v)}>
          + {labels.tailorLedger.addCharge}
        </Button>
      </div>

      {adding && (
        <ChargeForm
          tailor={tailor}
          onClose={() => setAdding(false)}
          onError={onError}
          onDone={onDone}
        />
      )}

      {tailor.charges.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{labels.tailorLedger.noCharges}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {tailor.charges.map((c) =>
            editingId === c.id ? (
              <li key={c.id} className="py-2">
                <ChargeForm
                  tailor={tailor}
                  initial={c}
                  onClose={() => setEditingId(null)}
                  onError={onError}
                  onDone={onDone}
                />
              </li>
            ) : (
              <ChargeRow
                key={c.id}
                charge={c}
                onEdit={() => setEditingId(c.id)}
                onError={onError}
                onDone={onDone}
              />
            ),
          )}
        </ul>
      )}
    </Card>
  );
}

function ChargeRow({
  charge,
  onEdit,
  onError,
  onDone,
}: {
  charge: TailorCharge;
  onEdit: () => void;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function voidIt() {
    setBusy(true);
    try {
      await api.post(`/tailors/charges/${charge.id}/void`, {});
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-medium tabular-nums">{formatKyat(charge.amount)}</p>
        <p className="text-xs text-muted-foreground">
          {fmtDate(charge.chargeDate)}
          {charge.pieces != null && charge.feePerPiece != null
            ? ` · ${charge.pieces} × ${charge.feePerPiece}`
            : ""}
          {charge.note ? ` · ${charge.note}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onEdit}>
          {labels.common.edit}
        </Button>
        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={voidIt}>
          {labels.tailorLedger.void}
        </Button>
      </div>
    </li>
  );
}

function ChargeForm({
  tailor,
  initial,
  onClose,
  onError,
  onDone,
}: {
  tailor: TailorDetail;
  initial?: TailorCharge;
  onClose: () => void;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [pieces, setPieces] = useState(initial?.pieces != null ? String(initial.pieces) : "");
  const [fee, setFee] = useState(
    initial?.feePerPiece != null
      ? String(initial.feePerPiece)
      : tailor.defaultFeePerPiece != null
        ? String(tailor.defaultFeePerPiece)
        : "",
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [amountDirty, setAmountDirty] = useState(!!initial);
  const [note, setNote] = useState(initial?.note ?? "");
  const [busy, setBusy] = useState(false);

  const suggested = (Number(pieces) || 0) * (Number(fee) || 0);

  function onPiecesFee(next: { pieces?: string; fee?: string }) {
    const p = next.pieces ?? pieces;
    const f = next.fee ?? fee;
    if (next.pieces !== undefined) setPieces(next.pieces);
    if (next.fee !== undefined) setFee(next.fee);
    if (!amountDirty) {
      const s = (Number(p) || 0) * (Number(f) || 0);
      if (s > 0) setAmount(String(s));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) {
      onError(labels.errors.required);
      return;
    }
    setBusy(true);
    try {
      const body = {
        amount: amt,
        pieces: pieces.trim() === "" ? undefined : Math.max(0, Number(pieces) || 0),
        feePerPiece: fee.trim() === "" ? undefined : Math.max(0, Number(fee) || 0),
        note: note.trim() || undefined,
      };
      if (initial) await api.patch(`/tailors/charges/${initial.id}`, body);
      else await api.post(`/tailors/${tailor.id}/charges`, body);
      onClose();
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="my-2 flex flex-col gap-3 rounded-xl border bg-background p-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={labels.tailorLedger.pieces}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={pieces}
            onChange={(e) => onPiecesFee({ pieces: e.target.value })}
            className={inputClass}
          />
        </Field>
        <Field label={labels.tailorLedger.feePerPiece}>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={fee}
            onChange={(e) => onPiecesFee({ fee: e.target.value })}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label={labels.tailorLedger.amount}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={0}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setAmountDirty(true);
            }}
            className={inputClass + " flex-1"}
          />
          {suggested > 0 && (
            <button
              type="button"
              onClick={() => {
                setAmount(String(suggested));
                setAmountDirty(true);
              }}
              className="shrink-0 rounded-lg border px-2 py-1 text-xs text-muted-foreground"
            >
              {labels.tailorLedger.useFee} ({formatKyat(suggested)})
            </button>
          )}
        </div>
      </Field>
      <Field label={labels.tailorLedger.note}>
        <input
          type="text"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {labels.common.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={busy} className="flex-1">
          {busy ? labels.common.saving : labels.common.save}
        </Button>
      </div>
    </form>
  );
}

// ── Payments ────────────────────────────────────────────────────────
function PaymentsSection({
  tailor,
  onError,
  onDone,
}: {
  tailor: TailorDetail;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{labels.tailorLedger.payments}</h2>
        <Button type="button" size="sm" variant="outline" onClick={() => setAdding((v) => !v)}>
          + {labels.tailorLedger.addPayment}
        </Button>
      </div>

      {adding && (
        <PaymentForm
          tailorId={tailor.id}
          onClose={() => setAdding(false)}
          onError={onError}
          onDone={onDone}
        />
      )}

      {tailor.payments.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">{labels.tailorLedger.noPayments}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {tailor.payments.map((p) => (
            <PaymentRow key={p.id} payment={p} onError={onError} onDone={onDone} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function PaymentRow({
  payment,
  onError,
  onDone,
}: {
  payment: TailorPaymentRow;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function voidIt() {
    setBusy(true);
    try {
      await api.post(`/tailors/payments/${payment.id}/void`, {});
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-medium tabular-nums text-emerald-700">−{formatKyat(payment.amount)}</p>
        <p className="text-xs text-muted-foreground">
          {fmtDate(payment.paymentDate)} · {methodLabel(payment.method)}
          {payment.notes ? ` · ${payment.notes}` : ""}
        </p>
      </div>
      <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={voidIt}>
        {labels.tailorLedger.void}
      </Button>
    </li>
  );
}

function PaymentForm({
  tailorId,
  onClose,
  onError,
  onDone,
}: {
  tailorId: number;
  onClose: () => void;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Math.max(0, Number(amount) || 0);
    if (amt <= 0) {
      onError(labels.errors.required);
      return;
    }
    setBusy(true);
    try {
      await api.post(`/tailors/${tailorId}/payments`, {
        amount: amt,
        method,
        notes: notes.trim() || undefined,
      });
      onClose();
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="my-2 flex flex-col gap-3 rounded-xl border bg-background p-3">
      <Field label={labels.tailorLedger.amount}>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputClass}
        />
      </Field>
      <Field label={labels.tailorLedger.method}>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={labels.tailorLedger.note}>
        <input
          type="text"
          maxLength={500}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={inputClass}
        />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>
          {labels.common.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={busy} className="flex-1">
          {busy ? labels.common.saving : labels.common.save}
        </Button>
      </div>
    </form>
  );
}
