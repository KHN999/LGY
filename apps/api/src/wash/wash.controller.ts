import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { WashService } from "./wash.service";
import { CreateWashDto, ListWashQueryDto, UpdateWashDto, VoidWashDto } from "./dto/wash.dto";

@Controller("wash")
@UseGuards(JwtAuthGuard)
export class WashController {
  constructor(private readonly service: WashService) {}

  @Post()
  create(@Body() dto: CreateWashDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list(@Query() q: ListWashQueryDto) {
    return this.service.list(q);
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateWashDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidWashDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.void(id, dto.reason, user.sub);
  }
}
