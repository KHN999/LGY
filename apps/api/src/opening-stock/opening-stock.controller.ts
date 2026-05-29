import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { OpeningStockService } from "./opening-stock.service";
import { CreateOpeningStockDto } from "./dto/opening-stock.dto";

@Controller("opening-stock")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class OpeningStockController {
  constructor(private readonly service: OpeningStockService) {}

  @Post()
  create(@Body() dto: CreateOpeningStockDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list() {
    return this.service.list();
  }
}
