import { IsEnum, IsInt, IsOptional, IsString, IsUrl, MaxLength, Min, MinLength } from "class-validator";
import { PartialType } from "@nestjs/mapped-types";
import { PartyStatusInput } from "../../customers/dto/customer.dto";

export class CreateEmployeeDto {
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
  monthlySalary?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @IsEnum(PartyStatusInput)
  status?: PartyStatusInput;
}

export class UpdateEmployeeDto extends PartialType(CreateEmployeeDto) {}
