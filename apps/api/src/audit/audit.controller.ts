import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import type { AuditLog } from "@lgy/db";
import { Type } from "class-transformer";
import { IsBooleanString, IsInt, IsOptional, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PaginationQueryDto } from "../common/pagination.dto";
import { AuditService } from "./audit.service";

class ListAuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(20) shop?: string;
  @IsOptional() @Type(() => Number) @IsInt() userId?: number;
  @IsOptional() @IsString() @MaxLength(50) entity?: string;
  @IsOptional() @IsBooleanString() failuresOnly?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

/** Admin-only. The audit log is read-only over HTTP — rows are written by the
 *  global AuditInterceptor, never via this controller. */
@Controller("audit")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: ListAuditQueryDto) {
    return this.audit.list({
      page: q.page ?? 1,
      limit: q.limit ?? 50,
      shop: q.shop,
      userId: q.userId,
      entity: q.entity,
      failuresOnly: q.failuresOnly === "true",
      search: q.search,
      from: q.from,
      to: q.to,
    });
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number): Promise<AuditLog> {
    return this.audit.getOne(id);
  }
}
