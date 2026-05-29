import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export enum AdjustmentLocationInput {
  WAREHOUSE = "WAREHOUSE",
  SHOP = "SHOP",
  IN_TRANSIT = "IN_TRANSIT",
}

export class AdjustmentCountDto {
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  /** The physically counted quantity at this location (0 is valid: counted none). */
  @IsInt()
  @Min(0)
  countedQty!: number;
}

export class CreateAdjustmentDto {
  @IsEnum(AdjustmentLocationInput)
  location!: AdjustmentLocationInput;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AdjustmentCountDto)
  counts!: AdjustmentCountDto[];

  /** Why stock is being corrected — required for the audit trail. */
  @IsString()
  @MaxLength(500)
  reason!: string;
}
