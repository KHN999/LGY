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
import { EmployeesService } from "./employees.service";
import { CreateEmployeeDto, UpdateEmployeeDto } from "./dto/employee.dto";
import { PaginationQueryDto } from "../common/pagination.dto";

class ListEmployeesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

@Controller("employees")
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Get()
  list(@Query() q: ListEmployeesQueryDto) {
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
  create(@Body() dto: CreateEmployeeDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateEmployeeDto) {
    return this.service.update(id, dto);
  }
}
