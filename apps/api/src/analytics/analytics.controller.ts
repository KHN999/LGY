import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  /** Whole-business overview for the active shop (admin only, read-only). */
  @Get("overview")
  overview() {
    return this.service.overview();
  }
}
