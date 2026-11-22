import { labels } from "@/lib/labels";

// Plain module (no "use client") so server pages can label a stored bank too.

/** Banks/wallets a transfer can come through. Mirrors the API's PaymentBank. */
export const BANKS = ["KPAY", "CB", "KBZ", "AYA", "MAB", "UNKNOWN"] as const;
export type BankCode = (typeof BANKS)[number];

/** Display name for a stored bank code (null → "", unrecognised → the code). */
export function bankLabel(code: string | null | undefined): string {
  if (!code) return "";
  return (labels.paymentReceipt.banks as Record<string, string>)[code] ?? code;
}
