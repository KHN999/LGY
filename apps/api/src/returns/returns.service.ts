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

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function returnLineKey(itemTypeId: number | null, itemName: string | null, unitPrice: number): string {
  if (itemTypeId != null) return `item:${itemTypeId}:${unitPrice}`;
  return `adhoc:${(cleanText(itemName) ?? "").toLowerCase()}:${unitPrice}`;
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
    for (const it of dto.items) {
      if (it.saleLineId === undefined && it.itemTypeId === undefined && !it.itemName?.trim()) {
        throw new BadRequestException("Each return item needs a saleLineId, itemTypeId, or itemName");
      }
      if (it.saleLineId === undefined && it.unitPrice === undefined) {
        throw new BadRequestException("Return items without saleLineId need a unitPrice");
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

      // Resolve every requested return against the original sale, then compute
      // the money value from the sale line itself instead of trusting the client.
      const saleLineById = new Map(sale.lines.map((line) => [line.id, line]));
      const sold = new Map<string, number>();
      const returned = new Map<string, number>();
      const sourceByKey = new Map<string, (typeof sale.lines)[number]>();
      for (const l of sale.lines) {
        const key = returnLineKey(l.itemTypeId, l.itemName, l.unitPrice);
        sold.set(key, (sold.get(key) ?? 0) + l.qty);
        if (!sourceByKey.has(key)) sourceByKey.set(key, l);
      }
      for (const r of sale.returns) {
        for (const l of r.lines) {
          const key = returnLineKey(l.itemTypeId, l.itemName, l.unitPrice);
          returned.set(key, (returned.get(key) ?? 0) + l.qty);
        }
      }

      const requested = new Map<string, number>();
      const resolvedItems = dto.items.map((it) => {
        const source =
          it.saleLineId !== undefined
            ? saleLineById.get(it.saleLineId)
            : sourceByKey.get(
                returnLineKey(
                  it.itemTypeId ?? null,
                  it.itemTypeId !== undefined ? null : cleanText(it.itemName),
                  it.unitPrice!,
                ),
              );
        if (!source) {
          throw new BadRequestException("Return item does not match the original sale");
        }
        const key = returnLineKey(source.itemTypeId, source.itemName, source.unitPrice);
        requested.set(key, (requested.get(key) ?? 0) + it.qty);
        return {
          key,
          itemTypeId: source.itemTypeId,
          itemName: source.itemTypeId == null ? cleanText(source.itemName) : null,
          qty: it.qty,
          unitPrice: source.unitPrice,
          lineTotal: source.unitPrice * it.qty,
        };
      });

      for (const [key, qty] of requested) {
        const available = (sold.get(key) ?? 0) - (returned.get(key) ?? 0);
        if (qty > available) {
          throw new BadRequestException(`Cannot return more than sold (available ${available})`);
        }
      }

      const returnTotal = resolvedItems.reduce((s, i) => s + i.lineTotal, 0);
      const refundAmount = dto.refundAmount ?? 0;
      if (refundAmount > returnTotal) {
        throw new BadRequestException("Refund cannot exceed the returned goods value");
      }

      const stockIn = new Map<number, number>();
      for (const it of resolvedItems) {
        if (it.itemTypeId != null) {
          stockIn.set(it.itemTypeId, (stockIn.get(it.itemTypeId) ?? 0) + it.qty);
        }
      }

      // Stock back in (catalog items only) via a RETURN_FROM_CUSTOMER event.
      const inLines = [...stockIn.entries()].map(([itemTypeId, qty]) => ({
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
            create: resolvedItems.map((i) => ({
              itemTypeId: i.itemTypeId,
              itemName: i.itemName,
              qty: i.qty,
              unitPrice: i.unitPrice,
              lineTotal: i.lineTotal,
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
