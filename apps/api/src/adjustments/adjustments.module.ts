import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { AdjustmentsController } from "./adjustments.controller";
import { AdjustmentsService } from "./adjustments.service";

@Module({
  imports: [InventoryModule],
  controllers: [AdjustmentsController],
  providers: [AdjustmentsService],
  exports: [AdjustmentsService],
})
export class AdjustmentsModule {}
