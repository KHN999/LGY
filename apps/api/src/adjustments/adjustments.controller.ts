import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { AdjustmentsService } from "./adjustments.service";
import { CreateAdjustmentDto } from "./dto/adjustment.dto";

@Controller("adjustments")
@UseGuards(JwtAuthGuard)
export class AdjustmentsController {
  constructor(private readonly service: AdjustmentsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateAdjustmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list() {
    return this.service.list();
  }
}
