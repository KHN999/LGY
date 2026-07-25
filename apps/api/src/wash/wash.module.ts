import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { WashController } from "./wash.controller";
import { WashService } from "./wash.service";

@Module({
  imports: [InventoryModule],
  controllers: [WashController],
  providers: [WashService],
})
export class WashModule {}
