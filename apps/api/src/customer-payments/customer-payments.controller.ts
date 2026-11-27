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
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { PaymentBank } from "../common/payment-parts";
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

const PAYMENT_CHANNELS = ["CASH", "KPAY", "CB", "KBZ", "AYA", "MAB", "UNKNOWN", "NOBANK"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

class PaymentMethodDto {
  @IsIn(["CASH", "BANK_TRANSFER"])
  method!: "CASH" | "BANK_TRANSFER";

  /** Required for BANK_TRANSFER; ignored for cash. */
  @IsOptional()
  @IsEnum(PaymentBank)
  bank?: PaymentBank;
}

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

  /** "account" = debt collected, not tied to a sale; "sale" = paid at a sale. */
  @IsOptional()
  @IsIn(["sale", "account"])
  linked?: "sale" | "account";

  /** Narrow the rows to one way of paying: CASH, a bank code (KPAY, CB, KBZ,
   *  AYA, MAB, UNKNOWN) or NOBANK = a bank transfer with no bank recorded. */
  @IsOptional()
  @IsIn(PAYMENT_CHANNELS)
  channel?: PaymentChannel;
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
    return this.service.recent({
      limit: q.limit ?? 100,
      from: q.fromDate,
      to: q.toDate,
      linked: q.linked,
      channel: q.channel,
    });
  }

  @Get("by-customer/:customerId")
  listForCustomer(
    @Param("customerId", ParseIntPipe) customerId: number,
    @Query() q: HistoryQueryDto,
  ) {
    return this.service.listForCustomer(customerId, q.limit);
  }

  /** Correct how a payment was received (cash ↔ bank). The amount, the sale
   *  and the customer's balance are untouched. */
  @Post(":id/method")
  @UseGuards(RolesGuard)
  @Roles("admin")
  setMethod(@Param("id", ParseIntPipe) id: number, @Body() dto: PaymentMethodDto) {
    return this.service.setMethod(id, dto.method, dto.bank);
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
