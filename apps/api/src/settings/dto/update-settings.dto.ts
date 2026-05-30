import { IsOptional, IsString, MaxLength } from "class-validator";

/**
 * All fields optional — only the provided ones are changed. Empty strings on
 * the nullable fields clear them (stored as null); `shopName` is never cleared.
 */
export class UpdateSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  shopName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  social?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  receiptHeader?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  receiptFooter?: string;
}
