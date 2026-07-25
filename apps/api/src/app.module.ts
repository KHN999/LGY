import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthController } from "./health.controller";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { ItemTypesModule } from "./item-types/item-types.module";
import { CustomersModule } from "./customers/customers.module";
import { SuppliersModule } from "./suppliers/suppliers.module";
import { TailorsModule } from "./tailors/tailors.module";
import { DriversModule } from "./drivers/drivers.module";
import { EmployeesModule } from "./employees/employees.module";
import { InventoryModule } from "./inventory/inventory.module";
import { OpeningStockModule } from "./opening-stock/opening-stock.module";
import { TransfersModule } from "./transfers/transfers.module";
import { CutsModule } from "./cuts/cuts.module";
import { WashModule } from "./wash/wash.module";
import { SalesModule } from "./sales/sales.module";
import { CustomerPaymentsModule } from "./customer-payments/customer-payments.module";
import { SupplierOrdersModule } from "./supplier-orders/supplier-orders.module";
import { SupplierPaymentsModule } from "./supplier-payments/supplier-payments.module";
import { DailyCloseModule } from "./daily-close/daily-close.module";
import { AdjustmentsModule } from "./adjustments/adjustments.module";
import { StockExceptionsModule } from "./stock-exceptions/stock-exceptions.module";
import { ReturnsModule } from "./returns/returns.module";
import { SettingsModule } from "./settings/settings.module";
import { ShopModule } from "./shop/shop.module";
import { ExpensesModule } from "./expenses/expenses.module";
import { UsersModule } from "./users/users.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { AuditModule } from "./audit/audit.module";
import { ExportModule } from "./export/export.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"],
    }),
    PrismaModule,
    AuthModule,
    ItemTypesModule,
    CustomersModule,
    SuppliersModule,
    TailorsModule,
    DriversModule,
    EmployeesModule,
    InventoryModule,
    OpeningStockModule,
    TransfersModule,
    CutsModule,
    WashModule,
    SalesModule,
    CustomerPaymentsModule,
    SupplierOrdersModule,
    SupplierPaymentsModule,
    DailyCloseModule,
    AdjustmentsModule,
    StockExceptionsModule,
    ReturnsModule,
    SettingsModule,
    ShopModule,
    ExpensesModule,
    UsersModule,
    DashboardModule,
    AuditModule,
    ExportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
