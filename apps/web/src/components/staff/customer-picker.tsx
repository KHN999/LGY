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

// Stale-while-revalidate cache so the picker works offline (and opens instantly).
// Refreshed in the background whenever online, mirroring ItemTypeGrid.
const CUSTOMERS_LS = "lgy.customers";
function readCustomerCache(): Customer[] {
  try {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(CUSTOMERS_LS) : null;
    return v ? (JSON.parse(v) as Customer[]) : [];
  } catch {
    return [];
  }
}
function writeCustomerCache(list: Customer[]) {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(CUSTOMERS_LS, JSON.stringify(list));
  } catch {
    /* quota / private mode — ignore */
  }
}

// NFC + lowercase + strip separators — the offline fallback filter, mirroring
// the server's nameKey so Burmese byte-form variants still match.
const norm = (s: string) => s.normalize("NFC").toLowerCase().replace(/[\s._-]/g, "");

export function CustomerPicker({ open, onClose, onPick, debtorsOnly }: Props) {
  const [browse, setBrowse] = useState<Customer[]>([]); // full list (cache / initial fetch)
  const [results, setResults] = useState<Customer[] | null>(null); // server search hits
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Show cached customers immediately (works offline), then refresh online.
    // limit=1000 loads the WHOLE list — the old limit=200 left later customers
    // unfindable, which is a big reason staff created duplicates.
    const cached = readCustomerCache();
    if (cached.length) setBrowse(cached);
    const ctrl = new AbortController();
    setLoading(cached.length === 0);
    setError(null);
    api
      .get<Page<Customer>>("/customers?limit=1000", ctrl.signal)
      .then((r) => {
        setBrowse(r.data);
        writeCustomerCache(r.data);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        if (readCustomerCache().length === 0) setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [open]);

  // Debounced server search — NFC-aware and over ALL customers (not just the
  // loaded page). Falls back to a normalized client filter when offline.
  useEffect(() => {
    const q = search.trim();
    if (!open || !q) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api
        .get<Page<Customer>>(`/customers?limit=50&search=${encodeURIComponent(q)}`, ctrl.signal)
        .then((r) => setResults(r.data))
        .catch((e: Error) => {
          if (e.name !== "AbortError") setResults(null); // offline → client fallback below
        })
        .finally(() => setSearching(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [search, open]);

  const filtered = useMemo(() => {
    const q = search.trim();
    let list: Customer[];
    if (!q) {
      list = browse;
    } else if (results) {
      list = results; // server results (NFC-aware, all rows)
    } else {
      // Offline fallback: normalized filter of the loaded list.
      const k = norm(q);
      const digits = q.replace(/\D/g, "");
      list = browse.filter(
        (c) =>
          norm(c.name).includes(k) ||
          (digits.length >= 3 && (c.contact ?? "").replace(/\D/g, "").includes(digits)),
      );
    }
    if (debtorsOnly) list = list.filter((c) => c.balance > 0);
    return list;
  }, [browse, results, search, debtorsOnly]);

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
        {(loading || searching) && (
          <p className="p-4 text-center text-muted-foreground">{labels.common.loading}</p>
        )}
        {error && <p className="p-4 text-center text-destructive">{error}</p>}
        {!loading && !searching && !error && filtered.length === 0 && (
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
