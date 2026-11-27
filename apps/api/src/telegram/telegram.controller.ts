import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { TelegramService } from "./telegram.service";

@Controller("telegram")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class TelegramController {
  constructor(private readonly telegram: TelegramService) {}

  @Get("status")
  status() {
    return this.telegram.status();
  }

  /** Groups / people the bot has recently seen, to find the chat id. */
  @Get("chats")
  chats() {
    return this.telegram.chats();
  }

  @Post("test")
  test(@CurrentUser() user: AuthenticatedUser) {
    return this.telegram.sendNow(`✅ LGY bot စမ်းသပ်စာ\n👤 ${user.username}`);
  }
}
