import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export enum CreatePaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  MOBILE_MONEY = "MOBILE_MONEY",
  OTHER = "OTHER",
}

export enum CreateSaleKind {
  WHOLESALE = "WHOLESALE",
  RETAIL = "RETAIL",
}

export class CreateSaleItemDto {
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  @IsInt()
  @Min(1)
  qty!: number;

  /** Per-piece selling price in kyat (captured per line so one-off prices work). */
  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class CreateSaleDto {
  @IsInt()
  @Min(1)
  customerId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;

  /** Amount paid at sale time. 0 = pure credit sale. */
  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsEnum(CreatePaymentMethod)
  paymentMethod?: CreatePaymentMethod;

  /** Inherits from customer.defaultKind if not provided. */
  @IsOptional()
  @IsEnum(CreateSaleKind)
  kind?: CreateSaleKind;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsDateString()
  saleDate?: string;
}
