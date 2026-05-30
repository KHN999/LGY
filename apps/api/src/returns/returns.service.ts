import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReturnDto } from "./dto/create-return.dto";

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record a return against a posted sale (a separate "minus" transaction — the
   * original sale is never edited). Catalog items go back into shop stock via a
   * RETURN_FROM_CUSTOMER event; refundAmount is the cash handed back.
   */
  async create(dto: CreateReturnDto, createdById: number) {
    const returnTotal = dto.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const refundAmount = dto.refundAmount ?? 0;
    if (refundAmount > returnTotal) {
      throw new BadRequestException("Refund cannot exceed the returned goods value");
    }
    for (const it of dto.items) {
      if (it.itemTypeId === undefined && !it.itemName?.trim()) {
        throw new BadRequestException("Each return item needs an itemTypeId or itemName");
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({
        where: { id: dto.saleId },
        include: {
          lines: true,
          returns: { where: { voidedAt: null }, include: { lines: true } },
        },
      });
      if (!sale) throw new NotFoundException(`Sale ${dto.saleId} not found`);
      if (sale.voidedAt) throw new BadRequestException("Cannot return against a voided sale");

      // Don't allow returning more of a catalog item than was sold (minus prior returns).
      const sold = new Map<number, number>();
      for (const l of sale.lines) {
        if (l.itemTypeId != null) sold.set(l.itemTypeId, (sold.get(l.itemTypeId) ?? 0) + l.qty);
      }
      const alreadyReturned = new Map<number, number>();
      for (const r of sale.returns) {
        for (const l of r.lines) {
          if (l.itemTypeId != null) {
            alreadyReturned.set(l.itemTypeId, (alreadyReturned.get(l.itemTypeId) ?? 0) + l.qty);
          }
        }
      }
      const requested = new Map<number, number>();
      for (const it of dto.items) {
        if (it.itemTypeId != null) {
          requested.set(it.itemTypeId, (requested.get(it.itemTypeId) ?? 0) + it.qty);
        }
      }
      for (const [id, qty] of requested) {
        const available = (sold.get(id) ?? 0) - (alreadyReturned.get(id) ?? 0);
        if (qty > available) {
          throw new BadRequestException(
            `Cannot return more than sold for item #${id} (available ${available})`,
          );
        }
      }

      // Stock back in (catalog items only) via a RETURN_FROM_CUSTOMER event.
      const inLines = [...requested.entries()].map(([itemTypeId, qty]) => ({
        direction: "IN" as const,
        location: "SHOP" as const,
        itemTypeId,
        qty,
      }));
      let eventId: number | null = null;
      if (inLines.length > 0) {
        const event = await tx.inventoryEvent.create({
          data: {
            kind: "RETURN_FROM_CUSTOMER",
            notes: dto.notes,
            createdById,
            lines: { create: inLines },
          },
        });
        eventId = event.id;
      }

      return tx.saleReturn.create({
        data: {
          saleId: sale.id,
          customerId: sale.customerId,
          returnTotal,
          refundAmount,
          notes: dto.notes,
          eventId,
          createdById,
          lines: {
            create: dto.items.map((i) => ({
              itemTypeId: i.itemTypeId ?? null,
              itemName: i.itemTypeId !== undefined ? null : i.itemName?.trim() || null,
              qty: i.qty,
              unitPrice: i.unitPrice,
              lineTotal: i.unitPrice * i.qty,
            })),
          },
        },
        include: { lines: { include: { itemType: true } } },
      });
    });
  }

  async listForSale(saleId: number) {
    return this.prisma.saleReturn.findMany({
      where: { saleId, voidedAt: null },
      orderBy: { returnDate: "desc" },
      include: { lines: { include: { itemType: true } } },
    });
  }
}
