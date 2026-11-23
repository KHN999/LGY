"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  ApiError,
  type ExpenseRow,
  type ExpenseCategory,
  type Employee,
  type Driver,
} from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat, formatDate } from "@/lib/utils";
import { Field, inputClass } from "@/components/admin/form-field";
import { Button, Card, EmptyState } from "@/components/ui";
import { BANKS, bankLabel, type BankCode } from "@/lib/banks";

type RecipientType = "none" | "employee" | "driver" | "other";

function recipientText(e: ExpenseRow): string {
  if (e.paidToEmployee) return e.paidToEmployee.name;
  if (e.paidToDriver) return e.paidToDriver.name;
  return e.paidTo ?? "";
}

export function ExpensesManager({
  expenses,
  categories,
  employees,
  drivers,
}: {
  expenses: ExpenseRow[];
  categories: ExpenseCategory[];
  employees: Employee[];
  drivers: Driver[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {labels.expenses.total}: <span className="font-semibold tabular-nums">{formatKyat(total)}</span>
        </p>
        <Button type="button" onClick={() => setAdding((v) => !v)}>
          + {labels.expenses.add}
        </Button>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {adding && (
        <AddExpenseForm
          categories={categories}
          employees={employees}
          drivers={drivers}
          onClose={() => setAdding(false)}
          onError={setError}
          onDone={() => router.refresh()}
        />
      )}

      {expenses.length === 0 ? (
        <EmptyState>{labels.expenses.empty}</EmptyState>
      ) : (
        <Card>
          <ul className="flex flex-col divide-y">
            {expenses.map((e) => (
              <ExpenseRowItem key={e.id} expense={e} onError={setError} onDone={() => router.refresh()} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function ExpenseRowItem({
  expense,
  onError,
  onDone,
}: {
  expense: ExpenseRow;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const who = recipientText(expense);
  const isBank = expense.method === "BANK_TRANSFER";
  async function switchMethod() {
    setBusy(true);
    try {
      await api.post(`/expenses/${expense.id}/method`, { method: isBank ? "CASH" : "BANK_TRANSFER" });
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }
  async function voidIt() {
    setBusy(true);
    try {
      await api.post(`/expenses/${expense.id}/void`, {});
      onDone();
    } catch (err) {
      onError(err instanceof ApiError ? err.message : labels.errors.unknown);
    } finally {
      setBusy(false);
    }
  }
  return (
    <li className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="font-medium">
          {expense.category.labelMy}
          {who ? ` · ${who}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(expense.expenseDate)} ·{" "}
          {isBank
            ? `🏦 ${labels.paymentReceipt.methodBank}${expense.bank ? ` · ${bankLabel(expense.bank)}` : ""}`
            : `💵 ${labels.paymentReceipt.methodCash}`}
          {expense.notes ? ` · ${expense.notes}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-semibold tabular-nums text-rose-600">{formatKyat(expense.amount)}</span>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={switchMethod}>
          {isBank ? labels.expenses.switchToCash : labels.expenses.switchToBank}
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={voidIt}>
          {labels.expenses.void}
        </Button>
      </div>
    </li>
  );
}

function todayISO(): string {
  // Local YYYY-MM-DD for the date input default.
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

function AddExpenseForm({
  categories,
  employees,
  drivers,
  onClose,
  onError,
  onDone,
}: {
  categories: ExpenseCategory[];
  employees: Employee[];
  drivers: Driver[];
  onClose: () => void;
  onError: (m: string) => void;
  onDone: () => void;
}) {
  // 0 = "type a new name" (also the only choice when there are no categories yet).
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 0);
  const [newCategory, setNewCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [recipientType, setRecipientType] = useState<RecipientType>("none");
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? 0);
  const [driverId, setDriverId] = useState(drivers[0]?.id ?? 0);
  const [otherName, setOtherName] = useState("");
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [bank, setBank] = useState<BankCode | "">("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const amt = Math.max(0, Number(amount) || 0);
    const customName = categoryId === 0 ? newCategory.trim() : "";
    if ((categoryId === 0 && !customName) || amt <= 0) {
      onError(labels.errors.required);
      return;
    }
    setBusy(true);
    try {
      await api.post("/expenses", {
        ...(customName ? { categoryName: customName } : { categoryId }),
        amount: amt,
        method,
        bank: method === "BANK_TRANSFER" && bank ? bank : undefined,
        expenseDate: date || undefined,
        paidToEmployeeId: recipientType === "employee" ? employeeId : undefined,
        paidToDriverId: recipientType === "driver" ? driverId : undefined,
        paidTo: recipientType === "other" ? otherName.trim() || undefined : undefined,
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
    <Card className="p-4">
      <form onSubmit={submit} className="flex max-w-xl flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.expenses.category}>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.labelMy}
                </option>
              ))}
              <option value={0}>➕ {labels.expenses.newCategory}</option>
            </select>
            {categoryId === 0 && (
              <input
                type="text"
                autoFocus
                maxLength={80}
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder={labels.expenses.newCategoryPlaceholder}
                className={inputClass + " mt-2"}
              />
            )}
          </Field>
          <Field label={labels.expenses.amount}>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.expenses.date}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={labels.expenses.recipient}>
            <select
              value={recipientType}
              onChange={(e) => setRecipientType(e.target.value as RecipientType)}
              className={inputClass}
            >
              <option value="none">{labels.expenses.paidToNone}</option>
              <option value="employee">{labels.expenses.paidToEmployee}</option>
              <option value="driver">{labels.expenses.paidToDriver}</option>
              <option value="other">{labels.expenses.paidToOther}</option>
            </select>
          </Field>
        </div>

        {recipientType === "employee" && (
          <Field label={labels.expenses.paidToEmployee}>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(Number(e.target.value))}
              className={inputClass}
            >
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {recipientType === "driver" && (
          <Field label={labels.expenses.paidToDriver}>
            <select
              value={driverId}
              onChange={(e) => setDriverId(Number(e.target.value))}
              className={inputClass}
            >
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {recipientType === "other" && (
          <Field label={labels.expenses.paidToOther}>
            <input
              type="text"
              maxLength={150}
              value={otherName}
              onChange={(e) => setOtherName(e.target.value)}
              className={inputClass}
            />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.expenses.payMethod}>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "CASH" | "BANK_TRANSFER")}
              className={inputClass}
            >
              <option value="CASH">💵 {labels.paymentReceipt.methodCash}</option>
              <option value="BANK_TRANSFER">🏦 {labels.paymentReceipt.methodBank}</option>
            </select>
          </Field>
          {method === "BANK_TRANSFER" && (
            <Field label={labels.expenses.payBank}>
              <select
                value={bank}
                onChange={(e) => setBank(e.target.value as BankCode | "")}
                className={inputClass}
              >
                <option value="">{labels.expenses.bankAny}</option>
                {BANKS.map((b) => (
                  <option key={b} value={b}>
                    {bankLabel(b)}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>

        <Field label={labels.expenses.notes}>
          <input
            type="text"
            maxLength={500}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
          />
        </Field>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {labels.common.cancel}
          </Button>
          <Button type="submit" disabled={busy} className="flex-1">
            {busy ? labels.common.saving : labels.common.save}
          </Button>
        </div>
      </form>
    </Card>
  );
}
