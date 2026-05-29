import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { CreatePaymentMethod } from "./create-sale.dto";

export class AddPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsEnum(CreatePaymentMethod)
  method?: CreatePaymentMethod;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
