import { Type } from "class-transformer";
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export class CreateItemTypeDto {
  /** Stable internal key. UPPER_SNAKE_CASE recommended. Cannot be changed once set. */
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: "key must be UPPER_SNAKE_CASE" })
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  labelMy!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  emoji?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Shown in the shop sell screen. False = warehouse-only (e.g. ROLL). */
  @IsOptional()
  @IsBoolean()
  sellable?: boolean;

  /** Unit cost in kyat for valuing stock — per YARD for rolls, per PIECE for
   *  pieces. 0/omitted = not valued. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  costPrice?: number;
}

export class UpdateItemTypeDto extends PartialType(CreateItemTypeDto) {}
