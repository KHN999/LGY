import { Module } from "@nestjs/common";
import { InventoryModule } from "../inventory/inventory.module";
import { CutsController } from "./cuts.controller";
import { CutsService } from "./cuts.service";

@Module({
  imports: [InventoryModule],
  controllers: [CutsController],
  providers: [CutsService],
})
export class CutsModule {}
