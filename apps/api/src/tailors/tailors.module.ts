import { Module } from "@nestjs/common";
import { TailorsController } from "./tailors.controller";
import { TailorsService } from "./tailors.service";

@Module({
  controllers: [TailorsController],
  providers: [TailorsService],
  exports: [TailorsService],
})
export class TailorsModule {}
