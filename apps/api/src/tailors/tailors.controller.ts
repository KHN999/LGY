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
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload";
import { TailorsService } from "./tailors.service";
import {
  CreateTailorDto,
  UpdateTailorDto,
  CreateTailorChargeDto,
  UpdateTailorChargeDto,
  CreateTailorPaymentDto,
  VoidReasonDto,
  SendToTailorDto,
  ReceiveFromTailorDto,
  UpdateTailorJobDto,
} from "./dto/tailor.dto";
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
    // activeOnly=false from the "Inactive" tab means "inactive only" (not "all").
    const inactiveOnly = q.activeOnly === "false";
    return this.service.list({
      page: q.page ?? 1,
      limit: q.limit ?? 50,
      search: q.search,
      activeOnly: !inactiveOnly,
      inactiveOnly,
    });
  }

  @Get(":id")
  getOne(@Param("id", ParseIntPipe) id: number) {
    return this.service.getOne(id);
  }

  @Get("jobs/:eventId")
  getJob(@Param("eventId", ParseIntPipe) eventId: number) {
    return this.service.getJob(eventId);
  }

  @Get(":id/jobs")
  jobs(@Param("id", ParseIntPipe) id: number) {
    return this.service.getJobs(id);
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

  // ── Charges (fees owed) ──────────────────────────────────────────
  @Post(":id/charges")
  @UseGuards(RolesGuard)
  @Roles("admin")
  createCharge(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateTailorChargeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createCharge(id, dto, user.sub);
  }

  @Patch("charges/:chargeId")
  @UseGuards(RolesGuard)
  @Roles("admin")
  updateCharge(@Param("chargeId", ParseIntPipe) chargeId: number, @Body() dto: UpdateTailorChargeDto) {
    return this.service.updateCharge(chargeId, dto);
  }

  @Post("charges/:chargeId/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  voidCharge(
    @Param("chargeId", ParseIntPipe) chargeId: number,
    @Body() dto: VoidReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.voidCharge(chargeId, dto.reason, user.sub);
  }

  // ── Payments (money paid) ────────────────────────────────────────
  @Post(":id/payments")
  @UseGuards(RolesGuard)
  @Roles("admin")
  createPayment(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: CreateTailorPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.createPayment(id, dto, user.sub);
  }

  @Post("payments/:paymentId/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  voidPayment(
    @Param("paymentId", ParseIntPipe) paymentId: number,
    @Body() dto: VoidReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.voidPayment(paymentId, dto.reason, user.sub);
  }

  // ── Production: send / receive ───────────────────────────────────
  @Post(":id/send")
  @UseGuards(RolesGuard)
  @Roles("admin")
  send(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: SendToTailorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.sendToTailor(id, dto, user.sub);
  }

  @Post(":id/receive")
  @UseGuards(RolesGuard)
  @Roles("admin")
  receive(
    @Param("id", ParseIntPipe) id: number,
    @Body() dto: ReceiveFromTailorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.receiveFromTailor(id, dto, user.sub);
  }

  // ── Fix mistakes on a job (edit date/note, or undo) ──────────────
  @Patch("jobs/:eventId")
  @UseGuards(RolesGuard)
  @Roles("admin")
  updateJob(@Param("eventId", ParseIntPipe) eventId: number, @Body() dto: UpdateTailorJobDto) {
    return this.service.updateJob(eventId, dto);
  }

  @Post("jobs/:eventId/void")
  @UseGuards(RolesGuard)
  @Roles("admin")
  voidJob(
    @Param("eventId", ParseIntPipe) eventId: number,
    @Body() dto: VoidReasonDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.voidJob(eventId, dto.reason, user.sub);
  }
}
