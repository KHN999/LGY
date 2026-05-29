import { Injectable } from "@nestjs/common";
import type { Location, Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient | PrismaService;

export interface StockRow {
  itemTypeId: number;
  qty: number;
}

/**
 * The inventory ledger lives in (InventoryEvent, InventoryLine).
 * Stock at any (location, itemType) = Σ IN.qty − Σ OUT.qty for non-voided events.
 *
 * For tailor-held stock pass `tailorId` and the helper filters by location=TAILOR
 * + matching tailorId.
 */
@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stock for one (location, itemType). */
  async stockAt(
    location: Location,
    itemTypeId: number,
    tx: Tx = this.prisma,
  ): Promise<number> {
    const [ins, outs] = await Promise.all([
      tx.inventoryLine.aggregate({
        where: {
          direction: "IN",
          location,
          itemTypeId,
          tailorId: null,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
      tx.inventoryLine.aggregate({
        where: {
          direction: "OUT",
          location,
          itemTypeId,
          tailorId: null,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
    ]);
    return (ins._sum.qty ?? 0) - (outs._sum.qty ?? 0);
  }

  /** Bulk: full stock map for a location, keyed by itemTypeId. */
  async stockMapAt(
    location: Location,
    tx: Tx = this.prisma,
  ): Promise<Map<number, number>> {
    const [insBy, outsBy] = await Promise.all([
      tx.inventoryLine.groupBy({
        by: ["itemTypeId"],
        where: {
          direction: "IN",
          location,
          tailorId: null,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
      tx.inventoryLine.groupBy({
        by: ["itemTypeId"],
        where: {
          direction: "OUT",
          location,
          tailorId: null,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
    ]);
    const map = new Map<number, number>();
    for (const r of insBy) map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) + (r._sum.qty ?? 0));
    for (const r of outsBy) map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) - (r._sum.qty ?? 0));
    return map;
  }

  /** Bulk: stock currently with a specific tailor. */
  async stockMapAtTailor(
    tailorId: number,
    tx: Tx = this.prisma,
  ): Promise<Map<number, number>> {
    const [insBy, outsBy] = await Promise.all([
      tx.inventoryLine.groupBy({
        by: ["itemTypeId"],
        where: {
          direction: "IN",
          location: "TAILOR",
          tailorId,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
      tx.inventoryLine.groupBy({
        by: ["itemTypeId"],
        where: {
          direction: "OUT",
          location: "TAILOR",
          tailorId,
          event: { voidedAt: null },
        },
        _sum: { qty: true },
      }),
    ]);
    const map = new Map<number, number>();
    for (const r of insBy) map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) + (r._sum.qty ?? 0));
    for (const r of outsBy) map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) - (r._sum.qty ?? 0));
    return map;
  }
}
