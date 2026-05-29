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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { VoidSaleDto } from "./dto/void-sale.dto";
import { ListSalesQueryDto } from "./dto/list-sales.query.dto";

@Controller("sales")
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Post()
  create(@Body() dto: CreateSaleDto, @CurrentUser() user: AuthenticatedUser) {
    return this.sales.create(dto, user.sub);
  }

  @Get()
  list(@Query() q: ListSalesQueryDto) {
    return this.sales.list(q);
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.sales.getOne(id);
  }

  @Post(":id/payments")
  addPayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sales.addPayment(id, dto, user.sub);
  }

  @Post(":id/void")
  voidSale(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sales.voidSale(id, dto.reason, user.sub);
  }
}
