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

export enum TransferLocationInput {
  WAREHOUSE = "WAREHOUSE",
  SHOP = "SHOP",
  IN_TRANSIT = "IN_TRANSIT",
}

export class TransferItemDto {
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class CreateTransferDto {
  @IsEnum(TransferLocationInput)
  fromLocation!: TransferLocationInput;

  @IsEnum(TransferLocationInput)
  toLocation!: TransferLocationInput;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items!: TransferItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
