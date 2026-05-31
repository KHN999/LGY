import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreateExpenseDto {
  @IsInt()
  categoryId!: number;

  @IsInt()
  @Min(1)
  amount!: number;

  /** ISO date; defaults to now. */
  @IsOptional()
  @IsString()
  expenseDate?: string;

  /** Free-text recipient (used when not an employee/driver). */
  @IsOptional()
  @IsString()
  @MaxLength(150)
  paidTo?: string;

  @IsOptional()
  @IsInt()
  paidToEmployeeId?: number;

  @IsOptional()
  @IsInt()
  paidToDriverId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class VoidExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
