import { Type } from "class-transformer";
import {
  ArrayMaxSize,
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

/** One piece type produced by a cut. */
export class CutOutputDto {
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  @IsInt()
  @Min(1)
  qty!: number;
}

/**
 * Record a controlled cut of a roll into pieces. Rolls are counted as WHOLE
 * ROLLS, so a cut consumes `rollsUsed` from the roll's warehouse count and adds
 * the produced pieces. `yardsUsed` is reference-only (for costing later), not a
 * stock quantity. rollsUsed and pieces are both optional but at least one is
 * required.
 */
export class CreateCutDto {
  /** The roll/fabric being cut (its warehouse roll count is reduced). */
  @IsInt()
  @Min(1)
  rollItemTypeId!: number;

  /** Whole rolls consumed (reduces the roll's stock count). Omitted/0 = none. */
  @IsOptional()
  @IsInt()
  @Min(0)
  rollsUsed?: number;

  /** Total yards cut — reference/costing only, NOT a stock quantity. */
  @IsOptional()
  @IsInt()
  @Min(0)
  yardsUsed?: number;

  /** Pieces produced (added to warehouse). May be empty. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CutOutputDto)
  outputs?: CutOutputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Optional backdate (ISO). Omitted = now. */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

/** Fix a cut's date/note (no stock change). */
export class UpdateCutDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/** Cut history filter: date range + free-text item/roll (အလိပ်) search. */
export class ListCutsQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class VoidCutDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
