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
    // One grouped query (by direction + item) instead of two. Each DB round-trip
    // is costly on the deploy network, and inside a transaction the two old queries
    // ran serially — so we fetch once and net IN/OUT client-side.
    const rows = await tx.inventoryLine.groupBy({
      by: ["direction", "itemTypeId"],
      where: { location, tailorId: null, event: { voidedAt: null } },
      _sum: { qty: true },
    });
    const map = new Map<number, number>();
    for (const r of rows) {
      const qty = r._sum.qty ?? 0;
      map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) + (r.direction === "IN" ? qty : -qty));
    }
    return map;
  }

  /** Bulk: stock currently with a specific tailor. */
  async stockMapAtTailor(
    tailorId: number,
    tx: Tx = this.prisma,
  ): Promise<Map<number, number>> {
    const rows = await tx.inventoryLine.groupBy({
      by: ["direction", "itemTypeId"],
      where: { location: "TAILOR", tailorId, event: { voidedAt: null } },
      _sum: { qty: true },
    });
    const map = new Map<number, number>();
    for (const r of rows) {
      const qty = r._sum.qty ?? 0;
      map.set(r.itemTypeId, (map.get(r.itemTypeId) ?? 0) + (r.direction === "IN" ? qty : -qty));
    }
    return map;
  }
}
