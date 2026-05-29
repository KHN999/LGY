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
import { SupplierPaymentsService } from "./supplier-payments.service";
import { CreateSupplierPaymentDto } from "./dto/supplier-payment.dto";

class HistoryQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

@Controller("supplier-payments")
@UseGuards(JwtAuthGuard)
export class SupplierPaymentsController {
  constructor(private readonly service: SupplierPaymentsService) {}

  @Post()
  create(@Body() dto: CreateSupplierPaymentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get("by-supplier/:supplierId")
  listForSupplier(
    @Param("supplierId", ParseIntPipe) supplierId: number,
    @Query() q: HistoryQueryDto,
  ) {
    return this.service.listForSupplier(supplierId, q.limit);
  }
}
