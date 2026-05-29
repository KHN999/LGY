import { Module } from "@nestjs/common";
import { ItemTypesController } from "./item-types.controller";
import { ItemTypesService } from "./item-types.service";

@Module({
  controllers: [ItemTypesController],
  providers: [ItemTypesService],
  exports: [ItemTypesService],
})
export class ItemTypesModule {}
