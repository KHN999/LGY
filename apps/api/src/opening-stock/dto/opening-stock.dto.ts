import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export enum OpeningLocationInput {
  WAREHOUSE = "WAREHOUSE",
  SHOP = "SHOP",
}

export class OpeningStockLineDto {
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  @IsEnum(OpeningLocationInput)
  location!: OpeningLocationInput;

  @IsInt()
  @Min(1)
  qty!: number;

  /** Optional per-piece cost in kyat. Used for stock-value reporting. */
  @IsOptional()
  @IsInt()
  @Min(0)
  unitCost?: number;
}

export class CreateOpeningStockDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OpeningStockLineDto)
  items!: OpeningStockLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
