import { Type } from "class-transformer";
import { ArrayNotEmpty, IsArray, IsInt, IsOptional, Min, ValidateNested } from "class-validator";

/** One existing sale line getting a corrected unit price (admin price fix). */
export class EditSaleLineDto {
  @IsInt()
  id!: number;

  @IsInt()
  @Min(0)
  unitPrice!: number;
}

/**
 * Correct a sale's prices from admin: new unit prices for one or more existing
 * lines, and optionally a new discount. Quantities (and therefore stock) are
 * untouched — this only re-prices what was already sold.
 */
export class EditSaleLinesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EditSaleLineDto)
  lines!: EditSaleLineDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  discount?: number;
}
