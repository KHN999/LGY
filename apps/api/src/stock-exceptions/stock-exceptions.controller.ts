import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { StockExceptionsService } from "./stock-exceptions.service";
import { ResolveStockExceptionDto } from "./dto/resolve-exception.dto";

@Controller("stock-exceptions")
@UseGuards(JwtAuthGuard)
export class StockExceptionsController {
  constructor(private readonly service: StockExceptionsService) {}

  @Get()
  list() {
    return this.service.listOpen();
  }

  @Post(":id/resolve")
  @UseGuards(RolesGuard)
  @Roles("admin")
  resolve(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ResolveStockExceptionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.resolve(id, dto, user.sub);
  }
}
