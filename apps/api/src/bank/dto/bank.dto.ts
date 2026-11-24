import { IsBoolean, IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { PaymentBank } from "../../common/payment-parts";

export const BANK_TXN_TYPES = ["DEPOSIT", "WITHDRAW", "SET_BALANCE"] as const;
export type BankTxnType = (typeof BANK_TXN_TYPES)[number];

export class CreateBankTxnDto {
  @IsEnum(PaymentBank)
  bank!: PaymentBank;

  @IsIn(BANK_TXN_TYPES)
  type!: BankTxnType;

  /** DEPOSIT / WITHDRAW: how much moved (≥ 1). SET_BALANCE: the balance itself (≥ 0). */
  @IsInt()
  @Min(0)
  amount!: number;

  /** DEPOSIT: taken from shop cash. WITHDRAW: put into shop cash. Default true. */
  @IsOptional()
  @IsBoolean()
  cashSide?: boolean;

  /** DEPOSIT / WITHDRAW only; a SET_BALANCE always takes effect now. */
  @IsOptional()
  @IsDateString()
  txnDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
