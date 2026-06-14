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
import { IsBooleanString, IsOptional, IsString, MaxLength } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CustomersService } from "./customers.service";
import { CreateCustomerDto, MergeCustomersDto, UpdateCustomerDto } from "./dto/customer.dto";
import { ImportContactDto, ImportCustomersDto } from "./dto/import-customers.dto";
import { PaginationQueryDto } from "../common/pagination.dto";

class ListCustomersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsBooleanString()
  activeOnly?: string;
}

@Controller("customers")
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() q: ListCustomersQueryDto) {
    // activeOnly=false from the "Inactive" tab now means "inactive only" (not "all").
    const inactiveOnly = q.activeOnly === "false";
    return this.customers.list({
      page: q.page ?? 1,
      limit: q.limit ?? 50,
      search: q.search,
      activeOnly: !inactiveOnly,
      inactiveOnly,
    });
  }

  /** Customers whose (normalized) name matches — for the create-time duplicate
   *  warning and merge suggestions. Declared before :id so "similar" isn't parsed
   *  as an id. Any authenticated user (read-only). */
  @Get("similar")
  similar(@Query("name") name?: string, @Query("excludeId") excludeId?: string) {
    return this.customers.similar(name ?? "", excludeId ? Number(excludeId) : undefined);
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.customers.getOne(id);
  }

  /** Staff-accessible (no admin role): import a buyer from a phone contact during
   *  the sell flow — finds an existing customer by phone or creates a new one. */
  @Post("from-contact")
  fromContact(@Body() dto: ImportContactDto) {
    return this.customers.findOrCreateFromContact(dto.name, dto.contact);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("admin")
  create(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Post("import")
  @UseGuards(RolesGuard)
  @Roles("admin")
  importContacts(@Body() dto: ImportCustomersDto) {
    return this.customers.importContacts(dto);
  }

  @Patch(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  update(@Param("id", ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  /** Merge duplicate customers into this one (admin only) — moves all their
   *  sales/payments/returns here, then retires the duplicates. */
  @Post(":id/merge")
  @UseGuards(RolesGuard)
  @Roles("admin")
  merge(@Param("id", ParseIntPipe) id: number, @Body() dto: MergeCustomersDto) {
    return this.customers.merge(id, dto.sourceIds);
  }

  /** Soft-delete a customer and write off their debt (admin only). */
  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  remove(@Param("id", ParseIntPipe) id: number) {
    return this.customers.softDelete(id);
  }
}
