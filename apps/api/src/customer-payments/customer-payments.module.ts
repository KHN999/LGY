import { Module } from "@nestjs/common";
import { CustomerPaymentsController } from "./customer-payments.controller";
import { CustomerPaymentsService } from "./customer-payments.service";

@Module({
  controllers: [CustomerPaymentsController],
  providers: [CustomerPaymentsService],
  exports: [CustomerPaymentsService],
})
export class CustomerPaymentsModule {}
