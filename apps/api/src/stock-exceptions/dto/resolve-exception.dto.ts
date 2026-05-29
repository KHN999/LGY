import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class ResolveStockExceptionDto {
  /**
   * Physically counted quantity at the location. If provided, an ADJUSTMENT is
   * posted to true-up stock to this number. Omit to just close the exception
   * (e.g. it self-corrected after a restock).
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  countedQty?: number;

  /** Why / how it was resolved — required for the audit trail. */
  @IsString()
  @MaxLength(500)
  reason!: string;
}
