import { Module } from "@nestjs/common";
import { SupplierOrdersController } from "./supplier-orders.controller";
import { SupplierOrdersService } from "./supplier-orders.service";

@Module({
  controllers: [SupplierOrdersController],
  providers: [SupplierOrdersService],
  exports: [SupplierOrdersService],
})
export class SupplierOrdersModule {}
