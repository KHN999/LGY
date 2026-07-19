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
import { DateRangeQueryDto } from "../../common/date-range.query.dto";

/** Transfer history filter: date range + free-text item/roll (အလိပ်) search. */
export class ListTransfersQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}

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

  /** Optional backdate (ISO). Omitted = now. Must be an unclosed day. */
  @IsOptional()
  @IsString()
  occurredAt?: string;

  // ── Optional delivery / driver (records a transport expense) ──────
  @IsOptional()
  @IsInt()
  @Min(1)
  driverId?: number;

  /** Free-text driver name when not a tracked driver (e.g. a taxi). */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  driverName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  driverFee?: number;
}
