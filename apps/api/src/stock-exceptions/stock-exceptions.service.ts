import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Location, Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { AdjustmentsService } from "../adjustments/adjustments.service";
import { ResolveStockExceptionDto } from "./dto/resolve-exception.dto";

@Injectable()
export class StockExceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly adjustments: AdjustmentsService,
  ) {}

  /**
   * Called from SalesService INSIDE the sale transaction when a SHOP sale is
   * allowed to oversell. Upserts the single OPEN exception for (itemType,
   * location) and links the contributing sale. This is a worklist flag only —
   * it never stores a stock quantity; the ledger remains the source of truth.
   */
  async recordOversell(
    tx: Prisma.TransactionClient,
    params: {
      itemTypeId: number;
      location: Location;
      saleId: number;
      qtyBeyond: number;
      when: Date;
    },
  ) {
    const existing = await tx.stockException.findFirst({
      where: {
        itemTypeId: params.itemTypeId,
        location: params.location,
        status: "OPEN",
      },
    });
    const exception = existing
      ? await tx.stockException.update({
          where: { id: existing.id },
          data: { lastDetectedAt: params.when },
        })
      : await tx.stockException.create({
          data: {
            itemTypeId: params.itemTypeId,
            location: params.location,
            firstDetectedAt: params.when,
            lastDetectedAt: params.when,
          },
        });
    await tx.stockExceptionSale.create({
      data: {
        exceptionId: exception.id,
        saleId: params.saleId,
        qtyBeyond: params.qtyBeyond,
      },
    });
    return exception;
  }

  /**
   * Open exceptions, one per (item, location), with the LIVE deficit computed
   * from the ledger (never stored) and the contributing sales for drill-down.
   */
  async listOpen() {
    const rows = await this.prisma.stockException.findMany({
      where: { status: "OPEN" },
      orderBy: { lastDetectedAt: "desc" },
      include: {
        itemType: { select: { id: true, key: true, labelMy: true, emoji: true } },
        sales: {
          orderBy: { createdAt: "desc" },
          include: {
            sale: {
              select: {
                id: true,
                saleDate: true,
                voidedAt: true,
                customerName: true,
                customer: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Live stock per touched location — the ledger is the source of truth for the number.
    const locations = [...new Set(rows.map((r) => r.location))];
    const stockByLocation = new Map<Location, Map<number, number>>();
    for (const loc of locations) {
      stockByLocation.set(loc, await this.inventory.stockMapAt(loc));
    }

    return rows.map((r) => ({
      id: r.id,
      itemType: r.itemType,
      location: r.location,
      status: r.status,
      currentStock: stockByLocation.get(r.location)?.get(r.itemTypeId) ?? 0, // negative => shortfall
      // Exclude voided sales — their stock effect is already reversed in the ledger.
      soldBeyondTotal: r.sales.reduce((s, x) => s + (x.sale.voidedAt ? 0 : x.qtyBeyond), 0),
      firstDetectedAt: r.firstDetectedAt,
      lastDetectedAt: r.lastDetectedAt,
      sales: r.sales.map((x) => ({
        saleId: x.saleId,
        qtyBeyond: x.qtyBeyond,
        saleDate: x.sale.saleDate,
        voided: x.sale.voidedAt != null,
        customerName: x.sale.customer?.name ?? x.sale.customerName ?? null, // null = anonymous
      })),
    }));
  }

  /**
   * Resolve an open exception. If `countedQty` is provided, post an ADJUSTMENT
   * (inside the same transaction) to true-up stock to the physical count; then
   * mark the exception RESOLVED. Without `countedQty`, just close it.
   */
  async resolve(id: number, dto: ResolveStockExceptionDto, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const ex = await tx.stockException.findUnique({ where: { id } });
      if (!ex) throw new NotFoundException(`StockException ${id} not found`);
      if (ex.status !== "OPEN") {
        throw new ConflictException("Exception is already resolved");
      }

      let resolutionEventId: number | null = null;
      if (dto.countedQty !== undefined) {
        const event = await this.adjustments.setStock(
          ex.location,
          [{ itemTypeId: ex.itemTypeId, countedQty: dto.countedQty }],
          dto.reason,
          userId,
          tx,
        );
        resolutionEventId = event?.id ?? null;
      }

      return tx.stockException.update({
        where: { id: ex.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: userId,
          resolutionEventId,
          notes: dto.reason,
        },
      });
    });
  }
}
