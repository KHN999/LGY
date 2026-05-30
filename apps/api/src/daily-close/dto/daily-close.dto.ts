import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class PreviewDailyCloseQueryDto {
  /** Yangon date (YYYY-MM-DD) of the day being previewed. Defaults to today. */
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class CreateDailyCloseDto {
  /** Yangon date (YYYY-MM-DD) being closed. */
  @IsDateString()
  date!: string;

  /** Cash physically counted at end of day. */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  countedCash!: number;

  /** Cash kept in the drawer for tomorrow (the rest is taken home). Default 0.
   *  Becomes the next day's opening cash. Must be ≤ countedCash. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  carryForward?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
