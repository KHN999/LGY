import { Module } from "@nestjs/common";
import { DailyCloseModule } from "../daily-close/daily-close.module";
import { InventoryModule } from "../inventory/inventory.module";
import { CustomersModule } from "../customers/customers.module";
import { SuppliersModule } from "../suppliers/suppliers.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [DailyCloseModule, InventoryModule, CustomersModule, SuppliersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
