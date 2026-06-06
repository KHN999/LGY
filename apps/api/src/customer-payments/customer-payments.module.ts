import { Module } from "@nestjs/common";
import { CustomersModule } from "../customers/customers.module";
import { CustomerPaymentsController } from "./customer-payments.controller";
import { CustomerPaymentsService } from "./customer-payments.service";

@Module({
  imports: [CustomersModule],
  controllers: [CustomerPaymentsController],
  providers: [CustomerPaymentsService],
  exports: [CustomerPaymentsService],
})
export class CustomerPaymentsModule {}
