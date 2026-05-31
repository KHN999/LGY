import { IsDateString, IsOptional } from "class-validator";

/** Inclusive date range filter: from (gte) … to (lte). ISO strings. */
export class DateRangeQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
