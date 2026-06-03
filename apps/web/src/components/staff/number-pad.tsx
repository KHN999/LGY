"use client";

interface Props {
  onDigit: (d: number) => void;
  onBackspace: () => void;
  onClear: () => void;
}

/**
 * Big phone/calculator-style number keypad for cash-register entry.
 * No device keyboard, no +/- logic — just tap the digits. Edits whichever
 * field the caller has marked active.
 */
export function NumberPad({ onDigit, onBackspace, onClear }: Props) {
  const digitClass =
    "rounded-2xl border bg-card py-3 text-2xl font-bold tabular-nums shadow-sm active:scale-95 active:bg-accent";
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => (
        <button key={k} type="button" onClick={() => onDigit(k)} className={digitClass}>
          {k}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        aria-label="clear"
        className="rounded-2xl border bg-card py-3 text-xl font-semibold text-muted-foreground shadow-sm active:scale-95"
      >
        C
      </button>
      <button type="button" onClick={() => onDigit(0)} className={digitClass}>
        0
      </button>
      <button
        type="button"
        onClick={onBackspace}
        aria-label="backspace"
        className="rounded-2xl border bg-card py-3 text-2xl shadow-sm active:scale-95"
      >
        ⌫
      </button>
    </div>
  );
}
