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

import { PaymentBank } from "../../common/payment-parts";

export enum PaymentMethodInput {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_MONEY = "MOBILE_MONEY",
  OTHER = "OTHER",
}

export class CreateSupplierPaymentDto {
  @IsInt()
  @Min(1)
  supplierId!: number;

  /** Optional — pin payment to a specific order (advance payment / on-receipt). */
  @IsOptional()
  @IsInt()
  @Min(1)
  orderId?: number;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethodInput)
  method?: PaymentMethodInput;

  /** Which bank a non-cash payment went out of (ignored for cash). */
  @IsOptional()
  @IsEnum(PaymentBank)
  bank?: PaymentBank;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidSupplierPaymentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason!: string;
}
