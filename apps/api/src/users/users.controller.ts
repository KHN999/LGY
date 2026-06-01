import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { UsersService } from "./users.service";
import { CreateUserDto, ResetPasswordDto, UpdateUserDto } from "./dto/user.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  update(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.update(id, dto, user.sub);
  }

  @Post(":id/password")
  resetPassword(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.service.resetPassword(id, dto.password);
  }
}
