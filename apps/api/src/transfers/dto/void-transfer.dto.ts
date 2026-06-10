import { IsOptional, IsString, MaxLength } from "class-validator";

export class VoidTransferDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
