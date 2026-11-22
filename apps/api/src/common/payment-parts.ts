import { BadRequestException } from "@nestjs/common";

export type PaymentMethodValue = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "OTHER";

/** Where a bank transfer came from. Stored as text on CustomerPayment.bank. */
export enum PaymentBank {
  KPAY = "KPAY",
  CB = "CB",
  KBZ = "KBZ",
  AYA = "AYA",
  MAB = "MAB",
  UNKNOWN = "UNKNOWN",
}

export interface PaymentPart {
  method: PaymentMethodValue;
  amount: number;
  /** Set only on BANK_TRANSFER rows. */
  bank: PaymentBank | null;
}

/**
 * Break one tendered amount into the payment rows to record.
 *
 * Without `bankAmount` it is a single row in `method` (default CASH). With
 * `bankAmount` it is a split tender: that much by bank transfer and the rest in
 * cash — two rows, so cash-drawer and bank totals each stay correct. `method`
 * is ignored for a split. `bank` is kept only on the bank-transfer row.
 */
export function paymentParts(
  amount: number,
  method: PaymentMethodValue | undefined,
  bankAmount: number | undefined,
  bank?: PaymentBank,
): PaymentPart[] {
  if (amount <= 0) {
    if (bankAmount) throw new BadRequestException("Bank amount cannot exceed the amount paid");
    return [];
  }
  if (bankAmount === undefined) {
    const m = method ?? "CASH";
    return [{ method: m, amount, bank: m === "BANK_TRANSFER" ? (bank ?? null) : null }];
  }
  if (bankAmount > amount) {
    throw new BadRequestException("Bank amount cannot exceed the amount paid");
  }
  const parts: PaymentPart[] = [
    { method: "CASH", amount: amount - bankAmount, bank: null },
    { method: "BANK_TRANSFER", amount: bankAmount, bank: bank ?? null },
  ];
  return parts.filter((p) => p.amount > 0);
}
