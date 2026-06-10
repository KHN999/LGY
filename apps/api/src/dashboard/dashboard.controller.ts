import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { DateRangeQueryDto } from "../common/date-range.query.dto";
import { DashboardService } from "./dashboard.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get("summary")
  summary(@Query() q: DateRangeQueryDto) {
    return this.service.summary(q);
  }
}
