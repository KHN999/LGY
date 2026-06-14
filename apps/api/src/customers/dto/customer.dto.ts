import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from "class-validator";
import { PartialType } from "@nestjs/mapped-types";

export enum PartyStatusInput {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum SaleKindInput {
  WHOLESALE = "WHOLESALE",
  RETAIL = "RETAIL",
}

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  contact?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  photoUrl?: string;

  @IsOptional()
  @IsEnum(SaleKindInput)
  defaultKind?: SaleKindInput;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEnum(PartyStatusInput)
  status?: PartyStatusInput;
}

export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}

/** Merge one or more duplicate customers INTO the :id in the route (the survivor). */
export class MergeCustomersDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  sourceIds!: number[];
}
