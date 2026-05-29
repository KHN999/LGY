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
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { CustomerPaymentsService } from "./customer-payments.service";
import { CreateCustomerPaymentDto } from "./dto/customer-payment.dto";

class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

@Controller("customer-payments")
@UseGuards(JwtAuthGuard)
export class CustomerPaymentsController {
  constructor(private readonly service: CustomerPaymentsService) {}

  @Post()
  create(@Body() dto: CreateCustomerPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get("by-customer/:customerId")
  listForCustomer(
    @Param("customerId", ParseIntPipe) customerId: number,
    @Query() q: HistoryQueryDto,
  ) {
    return this.service.listForCustomer(customerId, q.limit);
  }
}
