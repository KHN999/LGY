import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import { PartyStatusInput } from "../../customers/dto/customer.dto";

export class CreateSupplierDto {
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
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEnum(PartyStatusInput)
  status?: PartyStatusInput;
}

export class UpdateSupplierDto extends PartialType(CreateSupplierDto) {}
