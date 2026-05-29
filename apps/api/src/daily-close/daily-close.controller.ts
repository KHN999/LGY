import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { DailyCloseService } from "./daily-close.service";
import { CreateDailyCloseDto, PreviewDailyCloseQueryDto } from "./dto/daily-close.dto";

@Controller("daily-close")
@UseGuards(JwtAuthGuard)
export class DailyCloseController {
  constructor(private readonly service: DailyCloseService) {}

  @Get("preview")
  preview(@Query() q: PreviewDailyCloseQueryDto) {
    return this.service.preview(q.date);
  }

  @Post()
  create(@Body() dto: CreateDailyCloseDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list() {
    return this.service.list();
  }
}
