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
 * Record a controlled cut of a roll into pieces. Yards used and pieces made are
 * BOTH optional (the gap between them is leftover) — but at least one must be
 * given. Rolls are tracked in yards; the pieces land in warehouse stock.
 */
export class CreateCutDto {
  /** The roll/fabric being cut (its warehouse yard stock is reduced). */
  @IsInt()
  @Min(1)
  rollItemTypeId!: number;

  /** Yards consumed from the roll. Omitted/0 = don't move the roll. */
  @IsOptional()
  @IsInt()
  @Min(0)
  yardsUsed?: number;

  /** Pieces produced (added to warehouse). May be empty (yards-only cut). */
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
