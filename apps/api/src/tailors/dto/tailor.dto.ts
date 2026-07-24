import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { PartialType } from "@nestjs/mapped-types";
import { PartyStatusInput } from "../../customers/dto/customer.dto";

const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "OTHER"] as const;
export type PaymentMethodInput = (typeof PAYMENT_METHODS)[number];

export class CreateTailorDto {
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
  @IsInt()
  @Min(0)
  defaultFeePerPiece?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEnum(PartyStatusInput)
  status?: PartyStatusInput;
}

export class UpdateTailorDto extends PartialType(CreateTailorDto) {}

/** A fee owed to the tailor (the "we owe" side). Amount is editable. */
export class CreateTailorChargeDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pieces?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  feePerPiece?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class UpdateTailorChargeDto extends PartialType(CreateTailorChargeDto) {}

export class CreateTailorPaymentDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsOptional()
  @IsIn(PAYMENT_METHODS)
  method?: PaymentMethodInput;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidReasonDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ── Send goods to a tailor (warehouse → tailor) ─────────────────────
export class TailorSendItemDto {
  @IsInt()
  @Min(1)
  itemTypeId!: number;

  @IsInt()
  @Min(1)
  qty!: number;
}

export class SendToTailorDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TailorSendItemDto)
  items!: TailorSendItemDto[];

  /** Materials consumed on send (e.g. အထက်ဆင်) — deducted from warehouse, NOT
   *  held at the tailor. Enter their counts separately from the pieces. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TailorSendItemDto)
  consumed?: TailorSendItemDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Optional backdate (ISO). Omitted = now. */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

// ── Receive from a tailor (tailor → warehouse, with transform/loss) ─
export class ReceiveLineDto {
  @IsInt()
  @Min(1)
  inputItemTypeId!: number;

  @IsInt()
  @Min(1)
  sentQty!: number;

  @IsInt()
  @Min(1)
  outputItemTypeId!: number;

  /** Good pieces returned; loss = sentQty − receivedQty. */
  @IsInt()
  @Min(0)
  receivedQty!: number;
}

export class ReceiveFromTailorDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveLineDto)
  lines!: ReceiveLineDto[];

  /** Total sewing fee for this batch (auto-charged to the tailor). */
  @IsOptional()
  @IsInt()
  @Min(0)
  fee?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Optional backdate (ISO). Omitted = now. */
  @IsOptional()
  @IsDateString()
  occurredAt?: string;
}

/** Edit an existing tailor job's date/note (no stock or fee changes). */
export class UpdateTailorJobDto {
  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
