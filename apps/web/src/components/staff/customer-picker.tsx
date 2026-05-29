"use client";

import { useEffect, useMemo, useState } from "react";
import { api, type Customer, type Page } from "@/lib/api-client";
import { labels } from "@/lib/labels";
import { formatKyat } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (c: Customer) => void;
  /** When true, only show customers with debt > 0. */
  debtorsOnly?: boolean;
}

export function CustomerPicker({ open, onClose, onPick, debtorsOnly }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get<Page<Customer>>("/customers?limit=200", ctrl.signal)
      .then((r) => setCustomers(r.data))
      .catch((e: Error) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open]);

  const filtered = useMemo(() => {
    let list = customers;
    if (debtorsOnly) list = list.filter((c) => c.balance > 0);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.contact ?? "").toLowerCase().includes(q),
    );
  }, [customers, search, debtorsOnly]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-2 border-b p-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border px-4 py-2 text-base"
        >
          ← {labels.common.back}
        </button>
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={labels.sell.searchCustomer}
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring"
        />
      </header>
      <div className="flex-1 overflow-y-auto p-3">
        {loading && (
          <p className="p-4 text-center text-muted-foreground">{labels.common.loading}</p>
        )}
        {error && <p className="p-4 text-center text-destructive">{error}</p>}
        {!loading && !error && filtered.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            {debtorsOnly ? labels.debts.none : labels.sell.noResults}
          </p>
        )}
        <ul className="flex flex-col gap-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  onPick(c);
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-xl border bg-card p-4 text-left active:scale-[0.99] transition"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-semibold truncate">{c.name}</p>
                  {c.contact && (
                    <p className="text-sm text-muted-foreground truncate">{c.contact}</p>
                  )}
                </div>
                <div className="text-right">
                  {c.balance > 0 && (
                    <p className="text-sm font-medium text-rose-600">
                      {labels.domain.debt}: {formatKyat(c.balance)}
                    </p>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
