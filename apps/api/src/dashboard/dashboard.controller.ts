import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { DateRangeQueryDto } from "../common/date-range.query.dto";
import { DashboardService } from "./dashboard.service";
import { MoneyService } from "./money.service";

@Controller("dashboard")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class DashboardController {
  constructor(
    private readonly service: DashboardService,
    private readonly moneyService: MoneyService,
  ) {}

  @Get("summary")
  summary(@Query() q: DateRangeQueryDto) {
    return this.service.summary(q);
  }

  /** Day-by-day money book with a running balance. from/to = YYYY-MM-DD (Yangon). */
  @Get("money")
  money(@Query("from") from?: string, @Query("to") to?: string) {
    return this.moneyService.overview({ from, to });
  }
}
