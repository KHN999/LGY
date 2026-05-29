import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma, TxnStatus } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { InventoryService } from "../inventory/inventory.service";
import { CustomersService } from "../customers/customers.service";
import { StockExceptionsService } from "../stock-exceptions/stock-exceptions.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { ListSalesQueryDto } from "./dto/list-sales.query.dto";

function statusFor(grandTotal: number, paidAmount: number): TxnStatus {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= grandTotal) return "PAID";
  return "PARTIAL";
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly customers: CustomersService,
    private readonly stockExceptions: StockExceptionsService,
  ) {}

  /**
   * Create a sale + its lines + a linked InventoryEvent kind=SALE — all in one
   * atomic transaction. Stock-out lines are created at SHOP location.
   * Validates: customer active, items exist, shop has enough stock, credit limit.
   */
  async create(dto: CreateSaleDto, createdById: number) {
    const goodsTotal = dto.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const discount = dto.discount ?? 0;
    const grandTotal = goodsTotal - discount;
    const paidAmount = dto.paidAmount ?? 0;

    if (discount < 0) throw new BadRequestException("Discount cannot be negative");
    if (discount > goodsTotal) throw new BadRequestException("Discount cannot exceed goods total");
    if (paidAmount > grandTotal) throw new BadRequestException("Paid amount cannot exceed grand total");

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer || customer.status !== "ACTIVE") {
        throw new NotFoundException(`Customer ${dto.customerId} not found or inactive`);
      }

      const ids = [...new Set(dto.items.map((i) => i.itemTypeId))];
      const types = await tx.itemType.findMany({
        where: { id: { in: ids } },
        select: { id: true, key: true, labelMy: true, isActive: true },
      });
      const typeMap = new Map(types.map((t) => [t.id, t]));
      for (const it of dto.items) {
        const t = typeMap.get(it.itemTypeId);
        if (!t) throw new NotFoundException(`ItemType ${it.itemTypeId} not found`);
        if (!t.isActive) throw new BadRequestException(`ItemType ${t.key} is inactive`);
      }

      // Shop stock check (sum requested per item to handle duplicate lines).
      const requested = new Map<number, number>();
      for (const it of dto.items) {
        requested.set(it.itemTypeId, (requested.get(it.itemTypeId) ?? 0) + it.qty);
      }
      // Stock policy (launch default): SHOP sales NEVER block — physical stock is
      // the source of truth and the ledger is corrected later. We still record the
      // shortfall as a StockException worklist item (after the sale exists, so we
      // can link it). Set SHOP_OVERSELL=block to enforce strict shop stock instead.
      const enforceStock = process.env.SHOP_OVERSELL === "block";
      const shopStock = await this.inventory.stockMapAt("SHOP", tx);
      const shortfalls: { itemTypeId: number; qtyBeyond: number }[] = [];
      for (const [id, qty] of requested) {
        const have = shopStock.get(id) ?? 0;
        if (have < qty) {
          if (enforceStock) {
            const t = typeMap.get(id);
            throw new ConflictException(
              `Not enough stock for ${t?.key ?? `#${id}`} at SHOP: have ${have}, need ${qty}`,
            );
          }
          // Units sold beyond what was actually available. If stock is already
          // negative, available is effectively 0 (don't double-count prior deficit).
          shortfalls.push({ itemTypeId: id, qtyBeyond: qty - Math.max(have, 0) });
        }
      }

      const kind = dto.kind ?? customer.defaultKind;
      const status = statusFor(grandTotal, paidAmount);
      const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();

      const sale = await tx.sale.create({
        data: {
          saleDate,
          customerId: customer.id,
          kind,
          goodsTotal,
          discount,
          grandTotal,
          paidAmount,
          status,
          notes: dto.notes,
          createdById,
          lines: {
            create: dto.items.map((i) => ({
              itemTypeId: i.itemTypeId,
              qty: i.qty,
              unitPrice: i.unitPrice,
              lineTotal: i.unitPrice * i.qty,
            })),
          },
        },
        include: { lines: { include: { itemType: true } }, customer: true },
      });

      // Linked InventoryEvent of kind=SALE with one OUT line per requested item.
      await tx.inventoryEvent.create({
        data: {
          kind: "SALE",
          occurredAt: saleDate,
          saleId: sale.id,
          createdById,
          lines: {
            create: [...requested.entries()].map(([itemTypeId, qty]) => ({
              direction: "OUT" as const,
              location: "SHOP" as const,
              itemTypeId,
              qty,
            })),
          },
        },
      });

      if (paidAmount > 0) {
        await tx.customerPayment.create({
          data: {
            customerId: customer.id,
            saleId: sale.id,
            amount: paidAmount,
            method: dto.paymentMethod ?? "CASH",
            paymentDate: saleDate,
            createdById,
          },
        });
      }

      // Log oversell exceptions now that the Sale row exists (worklist + audit).
      for (const s of shortfalls) {
        await this.stockExceptions.recordOversell(tx, {
          itemTypeId: s.itemTypeId,
          location: "SHOP",
          saleId: sale.id,
          qtyBeyond: s.qtyBeyond,
          when: saleDate,
        });
      }

      return sale;
    });
  }

  async list(q: ListSalesQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const includeVoided = q.includeVoided === "true";

    const where: Prisma.SaleWhereInput = {
      ...(includeVoided ? {} : { voidedAt: null }),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.status ? { status: q.status as TxnStatus } : {}),
      ...(q.kind ? { kind: q.kind } : {}),
      ...(q.fromDate || q.toDate
        ? {
            saleDate: {
              ...(q.fromDate ? { gte: new Date(q.fromDate) } : {}),
              ...(q.toDate ? { lte: new Date(q.toDate) } : {}),
            },
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.sale.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { saleDate: "desc" },
        include: {
          customer: { select: { id: true, name: true } },
          lines: { include: { itemType: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { data: rows, page, limit, total };
  }

  async getOne(id: number) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { include: { itemType: true } },
        payments: { where: { voidedAt: null }, orderBy: { paymentDate: "asc" } },
        createdBy: { select: { id: true, username: true, displayName: true } },
        voidedBy: { select: { id: true, username: true, displayName: true } },
      },
    });
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }

  async addPayment(saleId: number, dto: AddPaymentDto, createdById: number) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
      if (sale.voidedAt) throw new ConflictException("Cannot add payment to a voided sale");

      const newPaid = sale.paidAmount + dto.amount;
      if (newPaid > sale.grandTotal) {
        throw new BadRequestException(
          `Payment exceeds remaining (remaining ${sale.grandTotal - sale.paidAmount})`,
        );
      }

      const payment = await tx.customerPayment.create({
        data: {
          customerId: sale.customerId,
          saleId: sale.id,
          amount: dto.amount,
          method: dto.method ?? "CASH",
          paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
          notes: dto.notes,
          createdById,
        },
      });

      await tx.sale.update({
        where: { id: sale.id },
        data: { paidAmount: newPaid, status: statusFor(sale.grandTotal, newPaid) },
      });

      return payment;
    });
  }

  /**
   * Void a sale: marks the Sale row voided AND voids the linked InventoryEvent.
   * Stock is restored automatically because aggregations exclude voided rows.
   * Customer payments tied to this sale stay active (treated as customer credit).
   */
  async voidSale(saleId: number, reason: string, voidedById: number) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: saleId },
        include: { inventoryEvent: true },
      });
      if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
      if (sale.voidedAt) throw new ConflictException("Sale is already voided");

      const now = new Date();

      // Void the sale and reset its cached payment fields (payments are reversed below).
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          voidedAt: now,
          voidedById,
          voidReason: reason,
          paidAmount: 0,
          status: "UNPAID",
        },
      });

      // Void the linked stock movement — stock is restored (aggregations skip voided).
      if (sale.inventoryEvent) {
        await tx.inventoryEvent.update({
          where: { id: sale.inventoryEvent.id },
          data: { voidedAt: now, voidedById, voidReason: reason },
        });
      }

      // Reverse payments recorded against this sale, so the customer's balance
      // returns to its pre-sale value (the whole sale is treated as undone).
      await tx.customerPayment.updateMany({
        where: { saleId: sale.id, voidedAt: null },
        data: { voidedAt: now, voidedById, voidReason: `Sale #${sale.id} voided: ${reason}` },
      });

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: { lines: { include: { itemType: true } }, payments: true },
      });
    });
  }
}
