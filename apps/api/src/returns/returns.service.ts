import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { CreateReturnDto } from "./dto/create-return.dto";

type SaleReturnSqlRow = {
  id: number;
  saleId: number;
  customerId: number | null;
  returnDate: Date;
  returnTotal: number;
  refundAmount: number;
  notes: string | null;
  eventId: number | null;
  createdById: number;
  createdAt: Date;
  voidedAt: Date | null;
  voidedById: number | null;
  voidReason: string | null;
  lines: unknown;
};

function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

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
    const rows = await this.prisma.$queryRaw<SaleReturnSqlRow[]>(Prisma.sql`
      SELECT
        r.id,
        r."saleId",
        r."customerId",
        r."returnDate",
        r."returnTotal",
        r."refundAmount",
        r.notes,
        r."eventId",
        r."createdById",
        r."createdAt",
        r."voidedAt",
        r."voidedById",
        r."voidReason",
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'returnId', l."returnId",
                'itemTypeId', l."itemTypeId",
                'itemName', l."itemName",
                'qty', l.qty,
                'unitPrice', l."unitPrice",
                'lineTotal', l."lineTotal",
                'itemType',
                  CASE
                    WHEN t.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                      'id', t.id,
                      'key', t.key,
                      'labelMy', t."labelMy",
                      'emoji', t.emoji,
                      'sortOrder', t."sortOrder",
                      'isActive', t."isActive",
                      'sellable', t.sellable
                    )
                  END
              )
              ORDER BY l.id
            )
            FROM "SaleReturnLine" l
            LEFT JOIN "ItemType" t ON t.id = l."itemTypeId"
            WHERE l."returnId" = r.id
          ),
          '[]'::jsonb
        ) AS lines
      FROM "SaleReturn" r
      WHERE r."saleId" = ${saleId}
        AND r."voidedAt" IS NULL
      ORDER BY r."returnDate" DESC, r.id DESC
    `);
    return rows.map((r) => ({ ...r, lines: jsonArray(r.lines) }));
  }

  /** Undo a return: voids the SaleReturn and its RETURN_FROM_CUSTOMER event
   * (so the goods leave stock again and the receivable/refund are reversed). */
  async voidReturn(returnId: number, reason: string | undefined, userId: number) {
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.saleReturn.findUnique({ where: { id: returnId } });
      if (!r) throw new NotFoundException(`Return ${returnId} not found`);
      if (r.voidedAt) return r;
      if (r.eventId) {
        await tx.inventoryEvent.update({
          where: { id: r.eventId },
          data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
        });
      }
      return tx.saleReturn.update({
        where: { id: returnId },
        data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
      });
    });
  }
}
