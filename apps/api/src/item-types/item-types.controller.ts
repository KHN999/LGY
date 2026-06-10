import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { IsBooleanString, IsOptional } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { ItemTypesService } from "./item-types.service";
import { CreateItemTypeDto, UpdateItemTypeDto } from "./dto/item-type.dto";

class ListItemTypesQueryDto {
  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

@Controller("item-types")
@UseGuards(JwtAuthGuard)
export class ItemTypesController {
  constructor(private readonly service: ItemTypesService) {}

  @Get()
  list(@Query() q: ListItemTypesQueryDto) {
    return this.service.list({
      activeOnly: q.activeOnly !== "false",
      inactiveOnly: q.activeOnly === "false",
    });
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateItemTypeDto) {
    return this.service.create(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateItemTypeDto) {
    return this.service.update(id, dto);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
