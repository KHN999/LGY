import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { DateRangeQueryDto } from "../../common/date-range.query.dto";

/** One wash transform line: `qty` of input pieces become `qty` of the washed
 *  output category (1:1), consumed from and produced into the warehouse. */
export class WashLineDto {
  @IsInt()
  @Min(1)
  inputItemTypeId!: number;

  @IsInt()
  @Min(1)
  outputItemTypeId!: number;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateWashDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => WashLineDto)
  lines!: WashLineDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Optional backdate (ISO). Omitted = now. */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

/** Fix a wash's date/note (no stock change). */
export class UpdateWashDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListWashQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class VoidWashDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
