import { Module } from "@nestjs/common";
import { DailyCloseController } from "./daily-close.controller";
import { DailyCloseService } from "./daily-close.service";

@Module({
  controllers: [DailyCloseController],
  providers: [DailyCloseService],
})
export class DailyCloseModule {}
