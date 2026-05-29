"use client";

import { useState } from "react";

interface Props {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  /** Bigger steppers (+10/+100) for wholesale-sized quantities. */
  showJumps?: boolean;
}

/**
 * Big +/- counter for staff to enter quantities without keyboard.
 * Number is also tappable → opens an inline keypad for direct entry.
 */
export function QtyStepper({ value, onChange, min = 0, max, showJumps = true }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  function bump(d: number) {
    let next = value + d;
    if (next < min) next = min;
    if (max !== undefined && next > max) next = max;
    onChange(next);
  }

  function commitDraft() {
    const n = Number(draft);
    if (!Number.isFinite(n)) {
      setEditing(false);
      return;
    }
    let next = Math.max(min, Math.floor(n));
    if (max !== undefined) next = Math.min(max, next);
    onChange(next);
    setEditing(false);
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {showJumps && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bump(-10)}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
          >
            −10
          </button>
          <button
            type="button"
            onClick={() => bump(-1)}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
          >
            −1
          </button>
        </div>
      )}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="decrease"
          onClick={() => bump(-1)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-3xl font-bold text-white shadow active:scale-95"
        >
          −
        </button>
        {editing ? (
          <input
            autoFocus
            type="number"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraft();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-32 rounded-xl border bg-background px-4 py-3 text-center text-4xl font-bold outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(String(value));
              setEditing(true);
            }}
            className="w-32 rounded-xl border bg-card px-4 py-3 text-center text-4xl font-bold tabular-nums"
          >
            {value}
          </button>
        )}
        <button
          type="button"
          aria-label="increase"
          onClick={() => bump(1)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-white shadow active:scale-95"
        >
          +
        </button>
      </div>
      {showJumps && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => bump(10)}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
          >
            +10
          </button>
          <button
            type="button"
            onClick={() => bump(100)}
            className="rounded-lg border bg-card px-3 py-2 text-sm font-medium"
          >
            +100
          </button>
        </div>
      )}
    </div>
  );
}
