import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class ReturnItemDto {
  /** Preferred: the exact original sale line being returned. */
  @IsOptional()
  @IsInt()
  @Min(1)
  saleLineId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  itemTypeId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  itemName?: string;

  @IsInt()
  @Min(1)
  qty!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  unitPrice?: number;
}

export class CreateReturnDto {
  /** The original sale being (partially) returned. */
  @IsInt()
  @Min(1)
  saleId!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  /** Cash refunded to the buyer (0 = store credit / no cash back). Must be ≤ goods value. */
  @IsOptional()
  @IsInt()
  @Min(0)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidReturnDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
