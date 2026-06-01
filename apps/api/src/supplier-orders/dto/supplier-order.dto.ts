import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export enum SupplierOrderStatusInput {
  PENDING = "PENDING",
  PARTIAL_RECEIVED = "PARTIAL_RECEIVED",
  RECEIVED = "RECEIVED",
  CANCELLED = "CANCELLED",
}

export class CreateSupplierOrderDto {
  @IsInt()
  @Min(1)
  supplierId!: number;

  @IsInt()
  @Min(1)
  itemTypeId!: number;

  /** Number of rolls/units expected. */
  @IsInt()
  @Min(1)
  expectedQty!: number;

  /** Single agreed total cost in kyat (no per-unit pricing). */
  @IsInt()
  @Min(0)
  expectedTotal!: number;

  @IsOptional()
  @IsDateString()
  orderDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

/** Editable fields while order isn't fully received. */
export class UpdateSupplierOrderDto extends PartialType(CreateSupplierOrderDto) {
  @IsOptional()
  @IsEnum(SupplierOrderStatusInput)
  status?: SupplierOrderStatusInput;
}

export class CreateReceiptDto {
  @IsInt()
  @Min(1)
  receivedQty!: number;

  /** Single goods cost for this batch (kyat). */
  @IsInt()
  @Min(0)
  goodsCost!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  transportCost?: number;

  @IsOptional()
  @IsDateString()
  receivedAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class CancelReceiptDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ListSupplierOrdersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  supplierId?: number;

  @IsOptional()
  @IsEnum(SupplierOrderStatusInput)
  status?: SupplierOrderStatusInput;
}
