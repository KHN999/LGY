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
import { CutsService } from "./cuts.service";
import { CreateCutDto, ListCutsQueryDto, UpdateCutDto, VoidCutDto } from "./dto/cut.dto";

@Controller("cuts")
@UseGuards(JwtAuthGuard)
export class CutsController {
  constructor(private readonly service: CutsService) {}

  @Post()
  create(@Body() dto: CreateCutDto, @CurrentUser() user: AuthenticatedUser) {
    return this.service.create(dto, user.sub);
  }

  @Get()
  list(@Query() q: ListCutsQueryDto) {
    return this.service.list(q);
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Patch(":id")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCutDto) {
    return this.service.update(id, dto);
  }

  @Post(":id/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  void(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: VoidCutDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.void(id, dto.reason, user.sub);
  }
}
