import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";

enum LocationFilter {
  WAREHOUSE = "WAREHOUSE",
  SHOP = "SHOP",
  IN_TRANSIT = "IN_TRANSIT",
}

enum MovementLocationFilter {
  WAREHOUSE = "WAREHOUSE",
  SHOP = "SHOP",
  IN_TRANSIT = "IN_TRANSIT",
  TAILOR = "TAILOR",
}

class StockQueryDto {
  @IsEnum(LocationFilter)
  location!: LocationFilter;
}

class MovementsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  itemTypeId?: number;

  @IsOptional()
  @IsEnum(MovementLocationFilter)
  location?: MovementLocationFilter;

  @IsOptional()
  from?: string;

  @IsOptional()
  to?: string;
}

class EventListQueryDto {
  @IsOptional()
  kind?: string;
}

@Controller("inventory")
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(
    private readonly inventory: InventoryService,
    private readonly prisma: PrismaService,
  ) {}

  /** Stock at a fixed location, keyed by itemTypeId. */
  @Get("stock")
  async stock(@Query() q: StockQueryDto) {
    return this.inventory.stockRowsAt(q.location);
  }

  /** Stock valuation (warehouse + shop) — qty × cost per item, with totals. */
  @Get("value")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async value() {
    return this.inventory.valuation();
  }

  /** Stock movement history (ledger) — filterable by item + location; running
   *  balance when both are set. Visible to staff (no admin guard). */
  @Get("movements")
  async movements(@Query() q: MovementsQueryDto) {
    return this.inventory.movements({
      itemTypeId: q.itemTypeId,
      location: q.location,
      from: q.from,
      to: q.to,
    });
  }

  /** Stock currently with a specific tailor. */
  @Get("stock-at-tailor/:tailorId")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async stockAtTailor(@Param("tailorId", ParseIntPipe) tailorId: number) {
    return this.inventory.stockRowsAtTailor(tailorId);
  }

  /** Recent inventory events with their lines (debug / audit). */
  @Get("events")
  @UseGuards(RolesGuard)
  @Roles("admin")
  async events(@Query() q: EventListQueryDto) {
    return this.prisma.inventoryEvent.findMany({
      where: q.kind ? { kind: q.kind as never } : {},
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: {
        lines: { include: { itemType: true, tailor: true } },
        createdBy: { select: { id: true, username: true, displayName: true } },
      },
    });
  }
}
