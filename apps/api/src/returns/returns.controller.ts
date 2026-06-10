import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
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

  @Get()
  @UseGuards(RolesGuard)
  @Roles("admin")
  list(@Query("from") from?: string, @Query("to") to?: string) {
    return this.service.list({ from, to });
  }

  @Get("by-sale/:saleId")
  listForSale(@Param("saleId", ParseIntPipe) saleId: number) {
    return this.service.listForSale(saleId);
  }

  @Get("by-customer/:customerId")
  listForCustomer(@Param("customerId", ParseIntPipe) customerId: number) {
    return this.service.listForCustomer(customerId);
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
