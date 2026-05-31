import { Type } from "class-transformer";
import { IsInt, IsOptional } from "class-validator";
import { DateRangeQueryDto } from "../../common/date-range.query.dto";

export class ListExpensesQueryDto extends DateRangeQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  employeeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  driverId?: number;
}
