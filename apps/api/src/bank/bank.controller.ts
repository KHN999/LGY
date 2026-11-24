import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { BankService } from "./bank.service";
import { CreateBankTxnDto } from "./dto/bank.dto";

@Controller("bank")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class BankController {
  constructor(private readonly service: BankService) {}

  /** Balance per bank + the latest movements (optionally of one bank). */
  @Get()
  overview(@Query("bank") bank?: string) {
    return this.service.overview(bank);
  }

  @Post("txns")
  create(@Body() dto: CreateBankTxnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Post("txns/:id/void")
  void(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthenticatedUser) {
    return this.service.void(id, user.sub);
  }
}
