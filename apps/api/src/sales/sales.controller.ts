import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { SalesService } from "./sales.service";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { AddItemsDto } from "./dto/add-items.dto";
import { EditSaleDto } from "./dto/edit-sale-lines.dto";
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

  /** Sales that include a given item (dashboard items-sold drill-down). Declared
   *  before :id so "by-item" isn't parsed as a numeric id. */
  @Get("by-item")
  salesByItem(
    @Query("name") name?: string,
    @Query("fromDate") fromDate?: string,
    @Query("toDate") toDate?: string,
  ) {
    return this.sales.salesByItem({ name: name ?? "", from: fromDate, to: toDate });
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

  @Post(":id/add-items")
  addItems(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: AddItemsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sales.addItems(id, dto, user.sub);
  }

  /** Full edit of a posted sale (admin only) — items/qty/price/discount + paid. */
  @Patch(":id/lines")
  @UseGuards(RolesGuard)
  @Roles("admin")
  editSale(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: EditSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sales.editSale(id, dto, user.sub);
  }

  @Post(":id/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  voidSale(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidSaleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.sales.voidSale(id, dto.reason, user.sub);
  }
}
