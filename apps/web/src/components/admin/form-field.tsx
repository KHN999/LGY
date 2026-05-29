import { type ReactNode } from "react";

interface Props {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: Props) {
  return (
    <label className="flex flex-col gap-1.5" htmlFor={htmlFor}>
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && !error && <span className="text-xs text-muted-foreground">{hint}</span>}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </label>
  );
}

export const inputClass =
  "rounded-lg border bg-background px-3 py-2 text-base outline-none focus:ring-2 focus:ring-ring";
