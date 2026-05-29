import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { CustomersModule } from "../customers/customers.module";
import { StockExceptionsModule } from "../stock-exceptions/stock-exceptions.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [InventoryModule, CustomersModule, StockExceptionsModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
