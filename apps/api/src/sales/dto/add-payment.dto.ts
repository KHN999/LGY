import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { CreatePaymentMethod } from "./create-sale.dto";
import { PaymentBank } from "../../common/payment-parts";

export class AddPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsEnum(CreatePaymentMethod)
  method?: CreatePaymentMethod;

  /** Split tender: this much of the amount was paid by bank transfer, the rest
   *  in cash. Recorded as two payments. When set, the method field is ignored. */
  @IsOptional()
  @IsInt()
  @Min(0)
  bankAmount?: number;

  /** Which bank the bank-transfer part came through (ignored for cash). */
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
