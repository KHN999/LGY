import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from "class-validator";

export class ImportContactDto {
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  contact?: string;
}

/** Bulk-create customers from picked phone contacts. Duplicates (same phone, or
 *  same name when no phone) are skipped server-side. */
export class ImportCustomersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ImportContactDto)
  contacts!: ImportContactDto[];
}
