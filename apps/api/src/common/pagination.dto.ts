import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 50;
}

export interface PageResult<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
}

export function pageMeta(page = 1, limit = 50, total = 0) {
  return { page, limit, total };
}
