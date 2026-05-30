import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
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
  /** Catalog item (stock-tracked). Omit + set itemName for a one-off ad-hoc line. */
  @IsOptional()
  @IsInt()
  @Min(1)
  itemTypeId?: number;

  /** Free-text name for an ad-hoc line (used when itemTypeId is omitted). Not
   *  added to the catalog and not stock-tracked — appears only on this sale. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemName?: string;

  @IsInt()
  @Min(1)
  qty!: number;

  /** Per-piece selling price in kyat (captured per line so one-off prices work). */
  @IsInt()
  @Min(0)
  unitPrice!: number;

  /** Optional per-line note (e.g. reason for a free / replacement line). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  note?: string;
}

export class CreateSaleDto {
  /** Omit for a new/one-time buyer (see customerName + saveCustomer). */
  @IsOptional()
  @IsInt()
  @Min(1)
  customerId?: number;

  /** New buyer's name (used when customerId is omitted). Saved as a customer if
   *  saveCustomer is true, else kept only on this sale as a one-time name. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customerName?: string;

  /** With customerId omitted + this true: create a Customer from customerName and
   *  allow credit. Otherwise it is a one-time cash sale (must be paid in full). */
  @IsOptional()
  @IsBoolean()
  saveCustomer?: boolean;

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
