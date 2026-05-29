import { Type } from "class-transformer";
import { IsDateString, IsEnum, IsInt, IsOptional, Min } from "class-validator";
import { PaginationQueryDto } from "../../common/pagination.dto";
import { CreateSaleKind } from "./create-sale.dto";

export enum SaleStatusFilter {
  UNPAID = "UNPAID",
  PARTIAL = "PARTIAL",
  PAID = "PAID",
}

export class ListSalesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  customerId?: number;

  @IsOptional()
  @IsEnum(SaleStatusFilter)
  status?: SaleStatusFilter;

  @IsOptional()
  @IsEnum(CreateSaleKind)
  kind?: CreateSaleKind;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;

  @IsOptional()
  includeVoided?: string;
}
