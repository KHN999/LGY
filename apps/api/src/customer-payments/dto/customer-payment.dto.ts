import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

export enum PaymentMethodInput {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_MONEY = "MOBILE_MONEY",
  OTHER = "OTHER",
}

/**
 * General customer payment, not tied to a specific sale. Use this for "customer
 * paid down debt today" — the payment goes against their account-level balance.
 * For payments at sale time, use POST /sales (paidAmount field) or
 * POST /sales/:id/payments.
 */
export class CreateCustomerPaymentDto {
  @IsInt()
  @Min(1)
  customerId!: number;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethodInput)
  method?: PaymentMethodInput;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidCustomerPaymentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
