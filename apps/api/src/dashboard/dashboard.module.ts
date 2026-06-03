import { Module } from "@nestjs/common";
import { DailyCloseModule } from "../daily-close/daily-close.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CustomersModule } from "../customers/customers.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { SupplierOrdersModule } from "../supplier-orders/supplier-orders.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [DailyCloseModule, InventoryModule, CustomersModule, SuppliersModule, SupplierOrdersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
