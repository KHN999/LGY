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
import { IsBooleanString, IsOptional, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { TailorsService } from "./tailors.service";
import { CreateTailorDto, UpdateTailorDto } from "./dto/tailor.dto";
import { PaginationQueryDto } from "../common/pagination.dto";

class ListTailorsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

@Controller("tailors")
@UseGuards(JwtAuthGuard)
export class TailorsController {
  constructor(private readonly service: TailorsService) {}

  @Get()
  list(@Query() q: ListTailorsQueryDto) {
    return this.service.list({
      page: q.page ?? 1,
      limit: q.limit ?? 50,
      search: q.search,
      activeOnly: q.activeOnly !== "false",
    });
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateTailorDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateTailorDto) {
    return this.service.update(id, dto);
  }
}
