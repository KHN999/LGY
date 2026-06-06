import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsOptional, Min, ValidateNested } from "class-validator";
import { CreateSaleItemDto } from "./create-sale.dto";

/** Append more items to an existing (posted) sale — "add-on". Reuses the sale
 *  item shape. paidAmount is the cash taken now for these added items. */
export class AddItemsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @IsOptional()
  @IsInt()
  @Min(0)
  paidAmount?: number;
}
