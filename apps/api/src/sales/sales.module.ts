import { Module } from "@nestjs/common";
import { StockExceptionsModule } from "../stock-exceptions/stock-exceptions.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [StockExceptionsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
