import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { PaymentBank } from "../../common/payment-parts";

export class CreateExpenseDto {
  @IsInt()
  categoryId!: number;

  @IsInt()
  @Min(1)
  amount!: number;

  /** How it was paid; defaults to CASH. */
  @IsOptional()
  @IsIn(["CASH", "BANK_TRANSFER"])
  method?: "CASH" | "BANK_TRANSFER";

  /** Which bank a BANK_TRANSFER went through (ignored for cash). */
  @IsOptional()
  @IsEnum(PaymentBank)
  bank?: PaymentBank;

  /** ISO date; defaults to now. */
  @IsOptional()
  @IsString()
  expenseDate?: string;

  /** Free-text recipient (used when not an employee/driver). */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  paidTo?: string;

  @IsOptional()
  @IsInt()
  paidToEmployeeId?: number;

  @IsOptional()
  @IsInt()
  paidToDriverId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ExpenseMethodDto {
  @IsIn(["CASH", "BANK_TRANSFER"])
  method!: "CASH" | "BANK_TRANSFER";

  @IsOptional()
  @IsEnum(PaymentBank)
  bank?: PaymentBank;
}

export class VoidExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
