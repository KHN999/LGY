import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type SupplierOrderStatus } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateReceiptDto,
  CreateSupplierOrderDto,
  ListSupplierOrdersQueryDto,
  UpdateSupplierOrderDto,
} from "./dto/supplier-order.dto";

export interface RollOrdersSummary {
  /** Orders still awaiting delivery (PENDING or PARTIAL_RECEIVED). */
  openOrders: number;
  /** Rolls on those open orders: total ordered vs already received. */
  rollsOrdered: number;
  rollsReceived: number;
  /** Σ(expectedTotal − payments) over non-cancelled orders — what each row shows
   *  as "ပေးရန်ကျန်", incl. orders not yet received (a commitment). */
  committedToPay: number;
  /** Σ(received cost − payments) — payable for goods that have actually arrived. */
  dueNow: number;
}

@Injectable()
export class SupplierOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Roll-order obligations at a glance (dashboard card + page header). Single
   *  source of truth so both views agree. Order-scoped payments only. */
  async summary(): Promise<RollOrdersSummary> {
    const rows = await this.prisma.$queryRaw<RollOrdersSummary[]>(Prisma.sql`
      WITH o AS (
        SELECT
          so.status::text AS status,
          so."expectedQty",
          so."expectedTotal",
          COALESCE((SELECT SUM(r."receivedQty") FROM "SupplierOrderReceipt" r
                    WHERE r."orderId" = so.id AND r."voidedAt" IS NULL), 0)::int AS received_qty,
          COALESCE((SELECT SUM(r."goodsCost" + r."transportCost") FROM "SupplierOrderReceipt" r
                    WHERE r."orderId" = so.id AND r."voidedAt" IS NULL), 0)::int AS received_cost,
          COALESCE((SELECT SUM(p.amount) FROM "SupplierPayment" p
                    WHERE p."orderId" = so.id AND p."voidedAt" IS NULL), 0)::int AS paid
        FROM "SupplierOrder" so
        WHERE so.status::text <> 'CANCELLED'
      )
      SELECT
        COUNT(*) FILTER (WHERE status IN ('PENDING', 'PARTIAL_RECEIVED'))::int AS "openOrders",
        COALESCE(SUM("expectedQty") FILTER (WHERE status IN ('PENDING', 'PARTIAL_RECEIVED')), 0)::int AS "rollsOrdered",
        COALESCE(SUM(received_qty) FILTER (WHERE status IN ('PENDING', 'PARTIAL_RECEIVED')), 0)::int AS "rollsReceived",
        COALESCE(SUM(GREATEST((CASE WHEN received_cost > 0 THEN received_cost ELSE "expectedTotal" END) - paid, 0)), 0)::int AS "committedToPay",
        COALESCE(SUM(GREATEST(received_cost - paid, 0)), 0)::int AS "dueNow"
      FROM o
    `);
    return rows[0] ?? { openOrders: 0, rollsOrdered: 0, rollsReceived: 0, committedToPay: 0, dueNow: 0 };
  }

  async list(q: ListSupplierOrdersQueryDto) {
    return this.prisma.supplierOrder.findMany({
      where: {
        ...(q.supplierId ? { supplierId: q.supplierId } : {}),
        // A roll order is "deleted" by setting status = CANCELLED. Hide those by
        // default so the list shows only live orders; an explicit status filter
        // (e.g. to review cancelled ones) still overrides this.
        ...(q.status
          ? { status: q.status as SupplierOrderStatus }
          : { status: { not: "CANCELLED" as SupplierOrderStatus } }),
      },
      orderBy: { orderDate: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        itemType: { select: { id: true, key: true, labelMy: true, emoji: true } },
        receipts: { where: { voidedAt: null }, orderBy: { receivedAt: "asc" } },
        payments: { where: { voidedAt: null }, orderBy: { paymentDate: "asc" } },
      },
    });
  }

  async getOne(id: number) {
    const order = await this.prisma.supplierOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        itemType: true,
        receipts: { orderBy: { receivedAt: "asc" } },
        payments: { orderBy: { paymentDate: "asc" } },
      },
    });
    if (!order) throw new NotFoundException(`SupplierOrder ${id} not found`);
    return order;
  }

  async create(dto: CreateSupplierOrderDto, createdById: number) {
    const [supplier, itemType] = await Promise.all([
      this.prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
      this.prisma.itemType.findUnique({ where: { id: dto.itemTypeId } }),
    ]);
    if (!supplier || supplier.status !== "ACTIVE") {
      throw new BadRequestException(`Supplier ${dto.supplierId} not found or inactive`);
    }
    if (!itemType) throw new BadRequestException(`ItemType ${dto.itemTypeId} not found`);

    return this.prisma.supplierOrder.create({
      data: {
        supplierId: dto.supplierId,
        itemTypeId: dto.itemTypeId,
        orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
        expectedQty: dto.expectedQty,
        expectedYards: dto.expectedYards ?? null,
        pricePerYard: dto.pricePerYard ?? null,
        expectedTotal: dto.expectedTotal,
        notes: dto.notes,
        createdById,
        status: "PENDING",
      },
      include: { supplier: true, itemType: true, receipts: true, payments: true },
    });
  }

  async update(id: number, dto: UpdateSupplierOrderDto) {
    const existing = await this.prisma.supplierOrder.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`SupplierOrder ${id} not found`);

    if (existing.status === "RECEIVED") {
      throw new ConflictException("Cannot edit a fully received order");
    }
    if (existing.status === "CANCELLED" && dto.status !== "PENDING") {
      throw new ConflictException("Cancelled order can only be re-opened");
    }

    if (dto.itemTypeId !== undefined) {
      const t = await this.prisma.itemType.findUnique({ where: { id: dto.itemTypeId } });
      if (!t) throw new BadRequestException(`ItemType ${dto.itemTypeId} not found`);
    }

    return this.prisma.supplierOrder.update({
      where: { id },
      data: {
        ...(dto.supplierId !== undefined ? { supplierId: dto.supplierId } : {}),
        ...(dto.itemTypeId !== undefined ? { itemTypeId: dto.itemTypeId } : {}),
        ...(dto.orderDate !== undefined ? { orderDate: new Date(dto.orderDate) } : {}),
        ...(dto.expectedQty !== undefined ? { expectedQty: dto.expectedQty } : {}),
        ...(dto.expectedYards !== undefined ? { expectedYards: dto.expectedYards } : {}),
        ...(dto.pricePerYard !== undefined ? { pricePerYard: dto.pricePerYard } : {}),
        ...(dto.expectedTotal !== undefined ? { expectedTotal: dto.expectedTotal } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status as SupplierOrderStatus } : {}),
      },
      include: { supplier: true, itemType: true, receipts: true, payments: true },
    });
  }

  /**
   * Record a partial arrival. Creates an InventoryEvent kind=RECEIPT with one
   * IN line at WAREHOUSE. Note: per-piece unitCost is NOT set on the IN line —
   * rolls vary in size and per-roll cost has no business meaning (V2 cutting
   * jobs will derive per-piece cost properly when rolls are processed).
   */
  async recordReceipt(orderId: number, dto: CreateReceiptDto, createdById: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.supplierOrder.findUnique({
        where: { id: orderId },
        include: { receipts: true },
      });
      if (!order) throw new NotFoundException(`SupplierOrder ${orderId} not found`);
      if (order.status === "RECEIVED") {
        throw new ConflictException("Order is already fully received");
      }
      if (order.status === "CANCELLED") {
        throw new ConflictException("Cannot record receipt on a cancelled order");
      }

      const receivedAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date();

      const event = await tx.inventoryEvent.create({
        data: {
          kind: "RECEIPT",
          occurredAt: receivedAt,
          notes: dto.notes,
          createdById,
          lines: {
            create: {
              direction: "IN" as const,
              location: "WAREHOUSE" as const,
              itemTypeId: order.itemTypeId,
              qty: dto.receivedQty,
              // unitCost intentionally null — see comment above.
            },
          },
        },
      });

      const receipt = await tx.supplierOrderReceipt.create({
        data: {
          orderId: order.id,
          receivedQty: dto.receivedQty,
          goodsCost: dto.goodsCost,
          transportCost: dto.transportCost ?? 0,
          receivedAt,
          notes: dto.notes,
          eventId: event.id,
          createdById,
        },
      });

      const totalReceived =
        order.receipts.filter((r) => !r.voidedAt).reduce((s, r) => s + r.receivedQty, 0) +
        dto.receivedQty;
      const newStatus: SupplierOrderStatus =
        totalReceived >= order.expectedQty ? "RECEIVED" : "PARTIAL_RECEIVED";

      await tx.supplierOrder.update({
        where: { id: order.id },
        data: { status: newStatus },
      });

      return receipt;
    });
  }

  /**
   * Cancel a recorded receipt (e.g. entered by mistake). Reverses the stock by
   * voiding the linked RECEIPT event, soft-deletes the receipt, and recomputes
   * the order status from the remaining non-voided receipts. The supplier balance
   * drops automatically (getBalance ignores voided receipts).
   */
  async cancelReceipt(receiptId: number, reason: string | undefined, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.supplierOrderReceipt.findUnique({
        where: { id: receiptId },
        include: { order: { include: { receipts: true } } },
      });
      if (!receipt) throw new NotFoundException(`Receipt ${receiptId} not found`);
      if (receipt.voidedAt) throw new ConflictException("Receipt is already cancelled");

      const now = new Date();
      const why = reason ?? `Receipt #${receiptId} cancelled`;

      // Reverse the stock that this receipt added at WAREHOUSE.
      await tx.inventoryEvent.update({
        where: { id: receipt.eventId },
        data: { voidedAt: now, voidedById: userId, voidReason: why },
      });
      await tx.supplierOrderReceipt.update({
        where: { id: receiptId },
        data: { voidedAt: now, voidedById: userId, voidReason: reason },
      });

      // Recompute order status from the receipts that remain (excluding this one).
      if (receipt.order.status !== "CANCELLED") {
        const remaining = receipt.order.receipts
          .filter((r) => r.id !== receiptId && !r.voidedAt)
          .reduce((s, r) => s + r.receivedQty, 0);
        const newStatus: SupplierOrderStatus =
          remaining === 0
            ? "PENDING"
            : remaining >= receipt.order.expectedQty
              ? "RECEIVED"
              : "PARTIAL_RECEIVED";
        await tx.supplierOrder.update({
          where: { id: receipt.order.id },
          data: { status: newStatus },
        });
      }

      return tx.supplierOrderReceipt.findUnique({ where: { id: receiptId } });
    });
  }
}
