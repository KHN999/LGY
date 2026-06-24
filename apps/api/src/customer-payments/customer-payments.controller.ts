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
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { CustomerPaymentsService, type PaymentResult } from "./customer-payments.service";
import {
  CreateCustomerPaymentDto,
  VoidCustomerPaymentDto,
} from "./dto/customer-payment.dto";

class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;
}

@Controller("customer-payments")
@UseGuards(JwtAuthGuard)
export class CustomerPaymentsController {
  constructor(private readonly service: CustomerPaymentsService) {}

  @Post()
  create(
    @Body() dto: CreateCustomerPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaymentResult> {
    return this.service.create(dto, user.sub);
  }

  /** Recent received payments (all customers) — staff "money received" history. */
  @Get()
  recent(@Query() q: HistoryQueryDto) {
    return this.service.recent({ limit: q.limit ?? 100, from: q.fromDate, to: q.toDate });
  }

  @Get("by-customer/:customerId")
  listForCustomer(
    @Param("customerId", ParseIntPipe) customerId: number,
    @Query() q: HistoryQueryDto,
  ) {
    return this.service.listForCustomer(customerId, q.limit);
  }

  @Post(":id/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidCustomerPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.void(id, dto.reason, user.sub);
  }
}
