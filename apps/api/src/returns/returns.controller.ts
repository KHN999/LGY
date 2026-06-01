import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { ReturnsService } from "./returns.service";
import { CreateReturnDto, VoidReturnDto } from "./dto/create-return.dto";

@Controller("returns")
@UseGuards(JwtAuthGuard)
export class ReturnsController {
  constructor(private readonly service: ReturnsService) {}

  @Post()
  create(@Body() dto: CreateReturnDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get("by-sale/:saleId")
  listForSale(@Param("saleId", ParseIntPipe) saleId: number) {
    return this.service.listForSale(saleId);
  }

  @Post(":id/void")
  voidReturn(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidReturnDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.voidReturn(id, dto.reason, user.sub);
  }
}
