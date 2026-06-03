import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { IsEnum, IsOptional } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { InventoryService } from "./inventory.service";
import { PrismaService } from "../prisma/prisma.service";

enum LocationFilter {
  WAREHOUSE = "WAREHOUSE",
  SHOP = "SHOP",
  IN_TRANSIT = "IN_TRANSIT",
}

class StockQueryDto {
  @IsEnum(LocationFilter)
  location!: LocationFilter;
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

  /** Stock currently with a specific tailor. */
  @Get("stock-at-tailor/:tailorId")
  async stockAtTailor(@Param("tailorId", ParseIntPipe) tailorId: number) {
    return this.inventory.stockRowsAtTailor(tailorId);
  }

  /** Recent inventory events with their lines (debug / audit). */
  @Get("events")
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
