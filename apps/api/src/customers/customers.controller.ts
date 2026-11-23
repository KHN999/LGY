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
import { CreateCustomerDto, DismissDuplicatesDto, MergeCustomersDto, UpdateCustomerDto } from "./dto/customer.dto";
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

  /** Suspected duplicate customers, grouped (admin clean-up page). */
  @Get("duplicates")
  @UseGuards(RolesGuard)
  @Roles("admin")
  duplicates() {
    return this.customers.duplicates();
  }

  /** Mark a group as different people so it is not suggested again. */
  @Post("duplicates/dismiss")
  @UseGuards(RolesGuard)
  @Roles("admin")
  dismissDuplicates(@Body() dto: DismissDuplicatesDto) {
    return this.customers.dismissDuplicates(dto.ids);
  }

  /** Recent merges that can still be undone (admin). */
  @Get("merges")
  @UseGuards(RolesGuard)
  @Roles("admin")
  merges() {
    return this.customers.recentMerges();
  }

  /** Undo one merge: moved sales/payments go back, the merged records return. */
  @Post("merges/:batchId/undo")
  @UseGuards(RolesGuard)
  @Roles("admin")
  undoMerge(@Param("batchId") batchId: string) {
    return this.customers.undoMerge(batchId);
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.customers.getOne(id);
  }

  /** Account statement for one customer: opening balance, every sale / payment /
   *  return in the period with a running balance, and the closing balance.
   *  `from` / `to` are Yangon days (YYYY-MM-DD); omit either for an open end. */
  @Get(":id/statement")
  statement(
    @Param("id", ParseIntPipe) id: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ) {
    const ymd = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
    return this.customers.statement(id, ymd(from), ymd(to));
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
