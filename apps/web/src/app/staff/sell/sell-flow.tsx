"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type Customer,
  type ItemType,
  type SaleKind,
  type ShopId,
  type ShopSettings,
} from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";
import { speak } from "@/lib/speech";
import { CustomerPicker } from "@/components/staff/customer-picker";
import { ItemTypeGrid } from "@/components/staff/item-type-grid";
import { NumberPad } from "@/components/staff/number-pad";
import { Receipt, type ReceiptData } from "@/components/staff/receipt";

type Step = "customer" | "items" | "review" | "done";

interface CartLine {
  itemType: ItemType | null; // null = ad-hoc free-text line
  itemName: string | null; // set for ad-hoc lines
  qty: number;
  unitPrice: number;
  stock: number;
  note: string | null; // reason for a free / replacement line
}

/**
 * Cash-register sell flow:
 *   customer → items (loop: pick type → qty → price) → review (paid) → save
 *   no typing required for happy path; voice confirms on save.
 */
export function SellFlow({ shop, shopId }: { shop?: ShopSettings; shopId: ShopId }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("customer");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [kind, setKind] = useState<SaleKind>("WHOLESALE");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [draft, setDraft] = useState<{
    type: ItemType | null; // null = ad-hoc (use `name`)
    name: string;
    stock: number;
    qty: number;
    price: number;
    note: string;
  } | null>(null);
  const [paid, setPaid] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [walkIn, setWalkIn] = useState(false); // one-time buyer (no account, cash only)
  const [saveAsNew, setSaveAsNew] = useState(false); // create a new customer on submit
  const [newName, setNewName] = useState("");
  const [custMode, setCustMode] = useState<"choose" | "new">("choose");
  const [activeField, setActiveField] = useState<"qty" | "price">("qty");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  // The free/replacement note box only appears once the user tries to add a
  // 0-price line — NOT reactively on price===0, which would flicker (and steal
  // focus) on every normal price entry as the first digit makes price non-zero.
  const [freeNotePrompt, setFreeNotePrompt] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [savedSale, setSavedSale] = useState<{ id: number; date: string } | null>(null);
  const wantPrintRef = useRef(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    // After a "Save & Print", the receipt has re-rendered with the real number — print, then go home.
    if (savedSale && wantPrintRef.current) {
      wantPrintRef.current = false;
      window.print();
      router.push("/staff?saved=sell");
      router.refresh();
    }
  }, [savedSale, router]);

  const goodsTotal = cart.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const remaining = goodsTotal - paid;

  function startAddItem(type: ItemType, stock: number) {
    setDraft({ type, name: type.labelMy, stock, qty: 0, price: 0, note: "" });
    setActiveField("qty");
    setEditingIndex(null);
    setFreeNotePrompt(false);
  }
  function startAddManual() {
    setDraft({ type: null, name: "", stock: 0, qty: 0, price: 0, note: "" });
    setActiveField("qty");
    setEditingIndex(null);
    setFreeNotePrompt(false);
  }
  function editLine(i: number) {
    const l = cart[i];
    if (!l) return;
    setDraft({
      type: l.itemType,
      name: l.itemType ? l.itemType.labelMy : l.itemName ?? "",
      stock: l.stock,
      qty: l.qty,
      price: l.unitPrice,
      note: l.note ?? "",
    });
    setEditingIndex(i);
    setActiveField("qty");
    setError(null);
    setFreeNotePrompt(false);
  }
  // Number keypad edits whichever field (qty / price) is highlighted.
  function padDigit(d: number) {
    // Typing a price means it isn't a free line — drop the free-note prompt.
    if (activeField === "price") setFreeNotePrompt(false);
    setDraft((prev) => {
      if (!prev) return prev;
      if (activeField === "qty") return { ...prev, qty: Math.min(999999, prev.qty * 10 + d) };
      return { ...prev, price: Math.min(99999999, prev.price * 10 + d) };
    });
  }
  function padBackspace() {
    setDraft((prev) => {
      if (!prev) return prev;
      if (activeField === "qty") return { ...prev, qty: Math.floor(prev.qty / 10) };
      return { ...prev, price: Math.floor(prev.price / 10) };
    });
  }
  function padClear() {
    setDraft((prev) => {
      if (!prev) return prev;
      return activeField === "qty" ? { ...prev, qty: 0 } : { ...prev, price: 0 };
    });
  }
  function commitDraft() {
    if (!draft) return;
    // Shop sales never block on stock (physical-is-truth). Overselling is allowed;
    // the backend records a StockException for back-office reconciliation.
    if (draft.qty <= 0) return;
    if (!draft.type && !draft.name.trim()) {
      setError(labels.sell.itemNameRequired);
      return;
    }
    // Price 0 = free/replacement → reveal the note box and require a reason
    // (this is the only place it appears, so normal price entry never flickers).
    if (draft.price === 0 && !draft.note.trim()) {
      setFreeNotePrompt(true);
      setError(labels.sell.noteRequired);
      return;
    }
    setError(null);
    const line: CartLine = {
      itemType: draft.type,
      itemName: draft.type ? null : draft.name.trim(),
      qty: draft.qty,
      unitPrice: draft.price,
      stock: draft.stock,
      note: draft.note.trim() || null,
    };
    setCart((prev) =>
      editingIndex !== null
        ? prev.map((l, idx) => (idx === editingIndex ? line : l))
        : [...prev, line],
    );
    setDraft(null);
    setEditingIndex(null);
    setFreeNotePrompt(false);
  }
  function removeLine(i: number) {
    setCart((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Import a buyer straight from the phone's address book (Android Chrome) and
  // select them for this sale — finds an existing customer by phone (so repeats
  // don't duplicate) or creates one, keeping the name + first phone number.
  async function importFromPhone() {
    setError(null);
    const cm = (
      navigator as Navigator & {
        contacts?: {
          select: (
            props: string[],
            opts?: { multiple?: boolean },
          ) => Promise<Array<{ name?: string[]; tel?: string[] }>>;
        };
      }
    ).contacts;
    if (!cm || typeof cm.select !== "function") {
      setError(labels.admin.importUnsupported);
      return;
    }
    setImporting(true);
    try {
      const [picked] = await cm.select(["name", "tel"], { multiple: false });
      const name = picked?.name?.[0]?.trim() ?? "";
      const contact = picked?.tel?.[0]?.trim() || undefined;
      if (!name) return;
      const c = await api.post<Customer>("/customers/from-contact", { name, contact });
      setCustomer(c);
      setKind(c.defaultKind);
      setWalkIn(false);
      setSaveAsNew(false);
      setCustMode("choose");
    } catch (err) {
      // Cancelling the picker rejects with AbortError — not a real error.
      if ((err as { name?: string })?.name === "AbortError") return;
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setImporting(false);
    }
  }

  async function onSubmit(print: boolean) {
    if (!customer && !saveAsNew && !walkIn) {
      setError(labels.sell.noCustomer);
      return;
    }
    if (cart.length === 0) {
      setError(labels.sell.noItems);
      return;
    }
    if (!walkIn && paid > goodsTotal) {
      setError(labels.sell.cantPayMore);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // One-time buyer = cash sale, paid in full. Existing/saved buyers can use credit.
      const paidAmount = walkIn ? goodsTotal : paid;
      const sale = await api.post<{ id: number; saleDate: string }>("/sales", {
        customerId: customer?.id,
        customerName: !customer ? newName.trim() || undefined : undefined,
        saveCustomer: saveAsNew || undefined,
        kind,
        items: cart.map((l) => ({
          ...(l.itemType ? { itemTypeId: l.itemType.id } : { itemName: l.itemName }),
          qty: l.qty,
          unitPrice: l.unitPrice,
          ...(l.note ? { note: l.note } : {}),
        })),
        paidAmount: paidAmount > 0 ? paidAmount : undefined,
        paymentMethod: paidAmount > 0 ? "CASH" : undefined,
      });
      // Voice confirmation — best-effort, silent on devices without my-MM.
      const totalPieces = cart.reduce((s, l) => s + l.qty, 0);
      const firstLabel = cart[0]?.itemType?.labelMy ?? cart[0]?.itemName ?? labels.units.htee;
      speak(labels.sell.voicePiecesSold(totalPieces, firstLabel));
      if (print) {
        // Re-render the receipt with the real sale number, then print + go home (see effect).
        wantPrintRef.current = true;
        setSavedSale({ id: sale.id, date: sale.saleDate });
      } else {
        router.push("/staff?saved=sell");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── STEP 1: Choose buyer (existing / new → save or one-time) ─────
  if (step === "customer") {
    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-4 sm:p-6">
        <BackLink href="/staff" />
        <h1 className="text-center text-2xl font-bold">{labels.sell.whoBuyer}</h1>

        {custMode === "choose" && !customer && (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="flex flex-col items-center gap-2 rounded-2xl bg-primary px-6 py-8 text-xl font-bold text-primary-foreground shadow-lg active:scale-[0.98]"
              >
                <span className="text-4xl">👤</span>
                {labels.sell.existingBuyer}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustMode("new");
                  setError(null);
                }}
                className="flex flex-col items-center gap-2 rounded-2xl border-2 border-primary/40 px-6 py-8 text-xl font-bold text-primary active:scale-[0.98]"
              >
                <span className="text-4xl">➕</span>
                {labels.sell.newBuyer}
              </button>
            </div>
            <button
              type="button"
              onClick={importFromPhone}
              disabled={importing}
              className="flex items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-base font-medium hover:bg-accent disabled:opacity-50"
            >
              📇 {importing ? labels.common.loading : labels.admin.importContacts}
            </button>
            {error && (
              <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
                {error}
              </p>
            )}
          </>
        )}

        {custMode === "new" && !customer && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{labels.sell.buyerName}</span>
              <input
                type="text"
                autoFocus
                value={newName}
                maxLength={100}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={labels.sell.buyerNamePlaceholder}
                className="w-full rounded-xl border bg-background px-4 py-3 text-xl outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="button"
              disabled={!newName.trim()}
              onClick={() => {
                setSaveAsNew(true);
                setWalkIn(false);
                setCustomer(null);
                setKind("WHOLESALE");
                setStep("items");
              }}
              className="rounded-xl bg-emerald-600 py-4 text-lg font-semibold text-white shadow disabled:opacity-50 active:scale-[0.98]"
            >
              {labels.sell.saveBuyer}
            </button>
            <button
              type="button"
              onClick={() => {
                setWalkIn(true);
                setSaveAsNew(false);
                setCustomer(null);
                setKind("RETAIL");
                setStep("items");
              }}
              className="rounded-xl border py-4 text-lg font-semibold active:scale-[0.98]"
            >
              {labels.sell.oneTimeBuyer}
            </button>
            <button
              type="button"
              onClick={() => {
                setCustMode("choose");
                setNewName("");
              }}
              className="self-center text-sm text-muted-foreground"
            >
              ← {labels.common.back}
            </button>
          </div>
        )}

        {customer && (
          <div className="rounded-2xl border bg-card p-4 text-center">
            <p className="text-lg font-bold">{customer.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{labels.sell.currentDebt}</p>
            <p className={"text-xl font-semibold " + (customer.balance > 0 ? "text-rose-600" : "")}>
              {formatKyat(customer.balance)}
            </p>
            <button
              type="button"
              onClick={() => {
                setKind(customer.defaultKind);
                setStep("items");
              }}
              className="mt-4 w-full rounded-xl bg-emerald-600 py-4 text-xl font-semibold text-white shadow active:scale-95"
            >
              {labels.common.next}
            </button>
            <button
              type="button"
              onClick={() => {
                setCustomer(null);
                setCustMode("choose");
              }}
              className="mt-2 text-sm text-muted-foreground"
            >
              {labels.sell.changeCustomer}
            </button>
          </div>
        )}

        <CustomerPicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={(c) => {
            setCustomer(c);
            setKind(c.defaultKind);
            setWalkIn(false);
            setSaveAsNew(false);
            setCustMode("choose");
          }}
        />
      </main>
    );
  }

  // ─── STEP 2: Pick items ───────────────────────────────────────────
  if (step === "items") {
    if (draft) {
      return (
        <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-2 p-3 pb-28 sm:gap-3 sm:p-6">
          <button
            type="button"
            onClick={() => {
              setDraft(null);
              setError(null);
              setEditingIndex(null);
            }}
            className="self-start rounded-lg border px-3 py-1.5 text-sm"
          >
            ← {labels.common.back}
          </button>
          {draft.type ? (
            <div className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-2.5">
              <span className="text-2xl">{draft.type.emoji}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold leading-tight">{draft.type.labelMy}</p>
                <p className="text-xs text-muted-foreground">
                  {labels.sell.inStock}: {draft.stock}
                </p>
              </div>
            </div>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{labels.sell.itemName}</span>
              <input
                type="text"
                autoFocus
                value={draft.name}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder={labels.sell.itemNamePlaceholder}
                className="w-full rounded-xl border bg-background px-4 py-3 text-xl outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          )}

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setActiveField("qty")}
              className={
                "flex items-center justify-between rounded-2xl border-2 px-5 py-2.5 text-left transition " +
                (activeField === "qty"
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/40"
                  : "border-border bg-card")
              }
            >
              <span className="text-base text-muted-foreground">{labels.sell.chooseQty}</span>
              <span
                className={
                  "text-3xl font-bold tabular-nums " +
                  (draft.qty === 0 ? "text-muted-foreground/40" : "")
                }
              >
                {draft.qty}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveField("price")}
              className={
                "flex items-center justify-between rounded-2xl border-2 px-5 py-2.5 text-left transition " +
                (activeField === "price"
                  ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/40"
                  : "border-border bg-card")
              }
            >
              <span className="text-base text-muted-foreground">{labels.sell.choosePrice}</span>
              <span className="flex items-baseline gap-1">
                <span
                  className={
                    "text-3xl font-bold tabular-nums " +
                    (draft.price === 0 ? "text-muted-foreground/40" : "")
                  }
                >
                  {draft.price}
                </span>
                <span className="text-lg text-muted-foreground">{labels.units.kyat}</span>
              </span>
            </button>
          </div>

          <div className="rounded-2xl bg-muted/50 px-4 py-2 text-center">
            <span className="text-base text-muted-foreground">{labels.common.total}: </span>
            <span className="text-xl font-bold">{formatKyat(draft.qty * draft.price)}</span>
          </div>

          {freeNotePrompt && (
            <input
              type="text"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              value={draft.note}
              maxLength={200}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              placeholder={labels.sell.freeNotePlaceholder}
              className="w-full rounded-2xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring"
            />
          )}

          {draft.type && draft.qty > draft.stock && (
            <p className="rounded-lg bg-amber-100 px-3 py-2 text-center text-xs text-amber-900">
              {labels.sell.oversellNote}
            </p>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="mt-auto flex flex-col gap-2 pt-1">
            <NumberPad onDigit={padDigit} onBackspace={padBackspace} onClear={padClear} />
            <button
              type="button"
              onClick={() => {
                // qty → Next → price → Add. Price 0 is allowed (free / replacement),
                // so Add becomes available once you're on the price field.
                if (draft.qty > 0 && activeField === "price") commitDraft();
                else setActiveField(draft.qty === 0 ? "qty" : "price");
              }}
              disabled={!draft.type && !draft.name.trim()}
              className="rounded-2xl bg-emerald-600 py-3.5 text-xl font-bold text-white shadow-lg disabled:opacity-50 active:scale-[0.98]"
            >
              {draft.qty > 0 && activeField === "price"
                ? editingIndex !== null
                  ? labels.common.save
                  : labels.common.add
                : labels.common.next}
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-4 p-4 pb-8 sm:p-6">
        <div className="sticky top-0 z-10 -mx-4 -mt-4 flex items-center justify-between gap-2 border-b bg-background/95 px-4 pb-2 pt-4 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6">
          <button
            type="button"
            onClick={() => setStep("customer")}
            className="rounded-lg border px-4 py-2"
          >
            ← {labels.common.back}
          </button>
          {/* Checkout lives top-right (away from the thumb's item-tapping zone and
              the browser toolbar) so it can't be pressed by accident mid-order. */}
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={() => {
              // Default paid to the full amount (most sales settle in full); the
              // staffer taps "as credit" or edits it down for a credit sale.
              if (!walkIn) setPaid(goodsTotal);
              setStep("review");
            }}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-base font-bold text-white shadow disabled:opacity-40 active:scale-[0.97]"
          >
            {labels.sell.review}{cart.length > 0 ? ` (${cart.length})` : ""} →
          </button>
        </div>

        <div className="rounded-2xl border bg-card p-3 text-sm">
          <span className="text-muted-foreground">{labels.domain.customer}: </span>
          <span className="font-semibold">
            {customer?.name ?? (newName.trim() || labels.sell.walkInCustomer)}
          </span>
          <span className="ml-2 rounded bg-muted px-2 py-0.5 text-xs">
            {kind === "WHOLESALE" ? labels.sell.wholesale : labels.sell.retail}
          </span>
        </div>

        <h1 className="text-center text-xl font-bold">{labels.sell.pickItem}</h1>
        <ItemTypeGrid
          locationForStock="SHOP"
          onPick={startAddItem}
          allowOversell
          sellableOnly
          shopId={shopId}
        />
        <button
          type="button"
          onClick={startAddManual}
          className="self-center rounded-xl border-2 border-dashed border-primary/40 px-5 py-2 text-sm font-semibold text-primary active:scale-[0.98]"
        >
          ✏️ {labels.sell.manualItem}
        </button>

        {cart.length > 0 && (
          <section className="rounded-2xl border bg-card p-3">
            <p className="mb-2 text-sm font-semibold">{labels.sell.cartHas} ({cart.length})</p>
            <ul className="flex flex-col divide-y">
              {cart.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {l.itemType?.emoji ?? "🧾"} {l.itemType?.labelMy ?? l.itemName} × {l.qty}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatKyat(l.unitPrice)} × {l.qty} = {formatKyat(l.qty * l.unitPrice)}
                    </p>
                    {l.note && <p className="text-xs text-muted-foreground">📝 {l.note}</p>}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => editLine(i)}
                      className="rounded-lg border px-3 py-1 text-xs"
                    >
                      {labels.common.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="rounded-lg border px-3 py-1 text-xs text-destructive"
                    >
                      {labels.sell.removeLine}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-right text-base font-bold">
              {labels.sell.grandTotal}: {formatKyat(goodsTotal)}
            </p>
          </section>
        )}

        {error && (
          <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-center text-destructive">
            {error}
          </p>
        )}

      </main>
    );
  }

  // ─── STEP 3: Review = receipt preview + save / save & print ───────
  const receiptData: ReceiptData = {
    saleId: savedSale?.id ?? null,
    date: savedSale?.date ?? new Date().toISOString(),
    customerName: customer?.name ?? (newName.trim() || null),
    customerContact: customer?.contact ?? null,
    lines: cart.map((l) => ({
      label: l.itemType?.labelMy ?? l.itemName ?? "",
      qty: l.qty,
      unitPrice: l.unitPrice,
      lineTotal: l.qty * l.unitPrice,
      note: l.note,
    })),
    grandTotal: goodsTotal,
    paid: walkIn ? goodsTotal : paid,
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-4 p-3 pb-40 sm:p-6">
      <button
        type="button"
        onClick={() => setStep("items")}
        className="self-start rounded-lg border px-4 py-2"
      >
        ← {labels.common.back}
      </button>

      {/* Receipt preview — exactly what prints on A5 */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <Receipt data={receiptData} shop={shop} />
      </div>

      {!walkIn && (
        <section className="rounded-2xl border bg-card p-4">
          <p className="mb-2 text-sm text-muted-foreground">{labels.sell.paidNow}</p>
          <div className="flex items-center justify-center gap-3">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={goodsTotal}
              value={paid || ""}
              onChange={(e) => setPaid(Math.max(0, Number(e.target.value) || 0))}
              placeholder="0"
              className="w-48 rounded-xl border bg-background px-4 py-3 text-center text-3xl font-bold tabular-nums outline-none focus:ring-2 focus:ring-ring"
            />
            <span className="text-lg text-muted-foreground">{labels.units.kyat}</span>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {[goodsTotal, Math.round(goodsTotal / 2), 50000, 100000, 500000].map((v) =>
              v > 0 && v <= goodsTotal ? (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPaid(v)}
                  className="rounded-lg border bg-card px-3 py-1 text-sm"
                >
                  {formatKyat(v)}
                </button>
              ) : null,
            )}
            <button
              type="button"
              onClick={() => setPaid(0)}
              className="rounded-lg border bg-card px-3 py-1 text-sm"
            >
              {labels.sell.asCredit}
            </button>
          </div>
          <div className="mt-3 flex items-center justify-between text-base">
            <span className="text-muted-foreground">{labels.sell.remaining}</span>
            <span className={remaining > 0 ? "font-semibold text-rose-600" : ""}>
              {formatKyat(remaining)}
            </span>
          </div>
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
            onClick={() => onSubmit(false)}
            disabled={submitting || cart.length === 0}
            className="flex-1 rounded-2xl border-2 border-emerald-600 py-4 text-lg font-bold text-emerald-700 disabled:opacity-50 active:scale-[0.98]"
          >
            {submitting ? labels.common.saving : labels.common.save}
          </button>
          <button
            type="button"
            onClick={() => onSubmit(true)}
            disabled={submitting || cart.length === 0}
            className="flex-1 rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white shadow disabled:opacity-50 active:scale-[0.98]"
          >
            🖨 {labels.sell.savePrint}
          </button>
        </div>
      </div>

      {mounted &&
        createPortal(
          <div id="print-receipt" className="hidden print:block">
            <Receipt data={receiptData} shop={shop} />
          </div>,
          document.body,
        )}
    </main>
  );
}

function BackLink({ href }: { href: string }) {
  return (
    <Link href={href} className="self-start rounded-lg border px-4 py-2">
      ← {labels.common.back}
    </Link>
  );
}
