import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { TransfersService } from "./transfers.service";
import { CreateTransferDto } from "./dto/transfer.dto";

@Controller("transfers")
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post()
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list() {
    return this.service.list();
  }
}
