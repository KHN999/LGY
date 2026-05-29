import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { AdjustmentsModule } from "../adjustments/adjustments.module";
import { StockExceptionsController } from "./stock-exceptions.controller";
import { StockExceptionsService } from "./stock-exceptions.service";

@Module({
  imports: [InventoryModule, AdjustmentsModule],
  controllers: [StockExceptionsController],
  providers: [StockExceptionsService],
  exports: [StockExceptionsService],
})
export class StockExceptionsModule {}
