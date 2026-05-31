import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";
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
