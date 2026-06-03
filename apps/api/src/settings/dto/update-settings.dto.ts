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
  @MaxLength(250)
  addressLine?: string;

  // phone/social hold several entries, one per line — hence the generous caps.
  @IsOptional()
  @IsString()
  @MaxLength(200)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
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
