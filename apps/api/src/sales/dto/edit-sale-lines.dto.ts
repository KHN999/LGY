import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from "class-validator";
import { CreatePaymentMethod, CreateSaleItemDto } from "./create-sale.dto";

/**
 * Full admin edit of a posted sale: `lines` is the COMPLETE new line set (edit
 * qty/price/item, add or remove lines). Stock is rebuilt to match; `paidAmount`
 * is the target total paid, reconciled against the payment rows.
 */
export class EditSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  lines!: CreateSaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  /** Target total paid after the edit (reconciled against CustomerPayment rows). */
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;

  /** Method for the reconciled payment when paid changes. */
  @IsOptional()
  @IsEnum(CreatePaymentMethod)
  paymentMethod?: CreatePaymentMethod;
}
