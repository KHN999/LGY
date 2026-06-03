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
import { SupplierOrdersService } from "./supplier-orders.service";
import {
  CancelReceiptDto,
  CreateReceiptDto,
  CreateSupplierOrderDto,
  ListSupplierOrdersQueryDto,
  UpdateSupplierOrderDto,
} from "./dto/supplier-order.dto";

@Controller("supplier-orders")
@UseGuards(JwtAuthGuard)
export class SupplierOrdersController {
  constructor(private readonly service: SupplierOrdersService) {}

  @Get()
  list(@Query() q: ListSupplierOrdersQueryDto) {
    return this.service.list(q);
  }

  // Must precede @Get(":id") so "summary" isn't captured as an id.
  @Get("summary")
  summary() {
    return this.service.summary();
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateSupplierOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateSupplierOrderDto,
  ) {
    return this.service.update(id, dto);
  }

  @Post(":id/receipts")
  @UseGuards(RolesGuard)
  @Roles("admin")
  recordReceipt(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.recordReceipt(id, dto, user.sub);
  }

  @Post("receipts/:receiptId/cancel")
  @UseGuards(RolesGuard)
  @Roles("admin")
  cancelReceipt(
    @Param("receiptId", ParseIntPipe) receiptId: number,
    @Body() dto: CancelReceiptDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.cancelReceipt(receiptId, dto.reason, user.sub);
  }
}
