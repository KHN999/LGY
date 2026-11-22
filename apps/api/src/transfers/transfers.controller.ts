import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { TransfersService } from "./transfers.service";
import { CreateTransferDto, ListTransfersQueryDto } from "./dto/transfer.dto";
import { VoidTransferDto } from "./dto/void-transfer.dto";

@Controller("transfers")
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(private readonly service: TransfersService) {}

  @Post()
  create(@Body() dto: CreateTransferDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list(@Query() q: ListTransfersQueryDto) {
    return this.service.list(q);
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  // Open to staff: they record transfers, so they can delete a mistaken one.
  // Soft void — the row and who voided it stay in the audit trail.
  @Post(":id/void")
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidTransferDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.void(id, dto.reason, user.sub);
  }
}
