import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { SupplierOrderStatus } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateReceiptDto,
  CreateSupplierOrderDto,
  ListSupplierOrdersQueryDto,
  UpdateSupplierOrderDto,
} from "./dto/supplier-order.dto";

@Injectable()
export class SupplierOrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: ListSupplierOrdersQueryDto) {
    return this.prisma.supplierOrder.findMany({
      where: {
        ...(q.supplierId ? { supplierId: q.supplierId } : {}),
        ...(q.status ? { status: q.status as SupplierOrderStatus } : {}),
      },
      orderBy: { orderDate: "desc" },
      include: {
        supplier: { select: { id: true, name: true } },
        itemType: { select: { id: true, key: true, labelMy: true, emoji: true } },
        receipts: { orderBy: { receivedAt: "asc" } },
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
        payments: { where: { voidedAt: null }, orderBy: { paymentDate: "asc" } },
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
        order.receipts.reduce((s, r) => s + r.receivedQty, 0) + dto.receivedQty;
      const newStatus: SupplierOrderStatus =
        totalReceived >= order.expectedQty ? "RECEIVED" : "PARTIAL_RECEIVED";

      await tx.supplierOrder.update({
        where: { id: order.id },
        data: { status: newStatus },
      });

      return receipt;
    });
  }
}
