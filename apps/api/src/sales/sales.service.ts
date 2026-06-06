import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type TxnStatus } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateSaleDto } from "./dto/create-sale.dto";
import { AddPaymentDto } from "./dto/add-payment.dto";
import { AddItemsDto } from "./dto/add-items.dto";
import { ListSalesQueryDto } from "./dto/list-sales.query.dto";

function statusFor(grandTotal: number, paidAmount: number): TxnStatus {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= grandTotal) return "PAID";
  return "PARTIAL";
}

type CreateSaleItemInput = {
  itemTypeId: number | null;
  itemName: string | null;
  qty: number;
  unitPrice: number;
  note: string | null;
};

type CreateSaleSqlRow = {
  id: number | null;
  saleDate: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
};

type SaleListSqlRow = {
  id: number;
  saleDate: Date;
  customerId: number | null;
  customerName: string | null;
  kind: TxnStatus | string;
  goodsTotal: number;
  discount: number;
  grandTotal: number;
  paidAmount: number;
  status: TxnStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  voidedAt: Date | null;
  voidReason: string | null;
  customer: { id: number; name: string } | null;
  lines: unknown;
  total: number;
};

type SaleDetailSqlRow = Omit<SaleListSqlRow, "total"> & {
  createdById: number;
  voidedById: number | null;
  createdBy: unknown;
  voidedBy: unknown;
  payments: unknown;
};

function cleanText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function jsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

@Injectable()
export class SalesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a sale + lines + linked stock/payment/oversell rows in one Postgres
   * statement. A single statement is atomic and avoids Prisma's per-step
   * transaction round-trips on the hot POS path.
   */
  async create(dto: CreateSaleDto, createdById: number) {
    const goodsTotal = dto.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const discount = dto.discount ?? 0;
    const grandTotal = goodsTotal - discount;
    const paidAmount = dto.paidAmount ?? 0;

    if (discount < 0) throw new BadRequestException("Discount cannot be negative");
    if (discount > goodsTotal) throw new BadRequestException("Discount cannot exceed goods total");
    if (paidAmount > grandTotal) throw new BadRequestException("Paid amount cannot exceed grand total");
    // Buyer resolves to one of: existing customer | newly-saved customer | one-time
    // (no account). A one-time sale has no account to carry debt, so it must be
    // paid in full — save the buyer to sell on credit.
    const willCreateCustomer = dto.customerId === undefined && !!dto.saveCustomer;
    const isOneTime = dto.customerId === undefined && !willCreateCustomer;
    if (isOneTime && paidAmount !== grandTotal) {
      throw new BadRequestException(
        "One-time / walk-in sale must be paid in full — save the buyer to sell on credit",
      );
    }
    if (willCreateCustomer && !dto.customerName?.trim()) {
      throw new BadRequestException("Buyer name is required to save the customer");
    }

    const saleDate = dto.saleDate ? new Date(dto.saleDate) : new Date();
    const oneTimeName =
      dto.customerId === undefined && !willCreateCustomer ? cleanText(dto.customerName) : null;
    const items: CreateSaleItemInput[] = dto.items.map((i) => ({
      itemTypeId: i.itemTypeId ?? null,
      itemName: i.itemTypeId === undefined ? cleanText(i.itemName) : null,
      qty: i.qty,
      unitPrice: i.unitPrice,
      note: cleanText(i.note),
    }));
    const status = statusFor(grandTotal, paidAmount);
    // Stock policy (launch default): SHOP sales NEVER block — physical stock is
    // the source of truth and the ledger is corrected later. Set
    // SHOP_OVERSELL=block to enforce strict shop stock instead.
    const enforceStock = process.env.SHOP_OVERSELL === "block";

    const rows = await this.prisma.$queryRaw<CreateSaleSqlRow[]>(Prisma.sql`
      WITH
        args AS (
          SELECT
            ${dto.customerId ?? null}::int AS customer_id,
            ${willCreateCustomer}::boolean AS will_create_customer,
            ${cleanText(dto.customerName)}::text AS customer_name,
            ${oneTimeName}::text AS one_time_name,
            ${JSON.stringify(items)}::jsonb AS sale_items,
            ${dto.kind ?? null}::"SaleKind" AS kind_override,
            ${goodsTotal}::int AS goods_total,
            ${discount}::int AS discount,
            ${grandTotal}::int AS grand_total,
            ${paidAmount}::int AS paid_amount,
            ${status}::"TxnStatus" AS txn_status,
            ${dto.paymentMethod ?? "CASH"}::"PaymentMethod" AS payment_method,
            ${dto.notes ?? null}::text AS notes,
            ${saleDate}::timestamp(3) AS sale_date,
            ${createdById}::int AS created_by_id,
            ${enforceStock}::boolean AS enforce_stock
        ),
        raw_items AS (
          SELECT elem, ord::int
          FROM args a
          CROSS JOIN LATERAL jsonb_array_elements(a.sale_items) WITH ORDINALITY AS item(elem, ord)
        ),
        items AS (
          SELECT
            ord,
            (elem->>'itemTypeId')::int AS item_type_id,
            NULLIF(BTRIM(elem->>'itemName'), '') AS item_name,
            (elem->>'qty')::int AS qty,
            (elem->>'unitPrice')::int AS unit_price,
            NULLIF(BTRIM(elem->>'note'), '') AS note
          FROM raw_items
        ),
        customer_existing AS (
          SELECT c.id, c."defaultKind"
          FROM "Customer" c
          JOIN args a ON c.id = a.customer_id
          WHERE c.status = 'ACTIVE'::"PartyStatus"
        ),
        catalog_requested AS (
          SELECT item_type_id, SUM(qty)::int AS requested_qty
          FROM items
          WHERE item_type_id IS NOT NULL
          GROUP BY item_type_id
        ),
        catalog_types AS (
          SELECT t.id, t.key, t."isActive"
          FROM "ItemType" t
          JOIN catalog_requested r ON r.item_type_id = t.id
        ),
        stock AS (
          SELECT
            r.item_type_id,
            COALESCE(
              SUM(
                CASE
                  WHEN ev."voidedAt" IS NULL AND il.direction = 'IN'::"InventoryDirection" THEN il.qty
                  WHEN ev."voidedAt" IS NULL AND il.direction = 'OUT'::"InventoryDirection" THEN -il.qty
                  ELSE 0
                END
              ),
              0
            )::int AS qty
          FROM catalog_requested r
          LEFT JOIN "InventoryLine" il
            ON il."itemTypeId" = r.item_type_id
           AND il.location = 'SHOP'::"Location"
           AND il."tailorId" IS NULL
          LEFT JOIN "InventoryEvent" ev ON ev.id = il."eventId"
          GROUP BY r.item_type_id
        ),
        customer_error AS (
          SELECT
            10 AS priority,
            'CUSTOMER_NOT_FOUND_OR_INACTIVE'::text AS error_code,
            FORMAT('Customer %s not found or inactive', a.customer_id)::text AS error_message
          FROM args a
          WHERE a.customer_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM customer_existing)
        ),
        item_identity_error AS (
          SELECT
            20 AS priority,
            'ITEM_REQUIRES_ID_OR_NAME'::text AS error_code,
            'Each item needs a catalog itemTypeId or an itemName'::text AS error_message
          FROM items i
          WHERE i.item_type_id IS NULL AND i.item_name IS NULL
          ORDER BY i.ord
          LIMIT 1
        ),
        missing_item_error AS (
          SELECT
            30 AS priority,
            'ITEM_NOT_FOUND'::text AS error_code,
            FORMAT('ItemType %s not found', r.item_type_id)::text AS error_message
          FROM catalog_requested r
          LEFT JOIN catalog_types t ON t.id = r.item_type_id
          WHERE t.id IS NULL
          ORDER BY r.item_type_id
          LIMIT 1
        ),
        inactive_item_error AS (
          SELECT
            40 AS priority,
            'ITEM_INACTIVE'::text AS error_code,
            FORMAT('ItemType %s is inactive', t.key)::text AS error_message
          FROM catalog_types t
          WHERE NOT t."isActive"
          ORDER BY t.id
          LIMIT 1
        ),
        stock_error AS (
          SELECT
            50 AS priority,
            'STOCK_SHORTAGE'::text AS error_code,
            FORMAT(
              'Not enough stock for %s at SHOP: have %s, need %s',
              COALESCE(t.key, FORMAT('#%s', r.item_type_id)),
              COALESCE(s.qty, 0),
              r.requested_qty
            )::text AS error_message
          FROM catalog_requested r
          LEFT JOIN catalog_types t ON t.id = r.item_type_id
          LEFT JOIN stock s ON s.item_type_id = r.item_type_id
          JOIN args a ON a.enforce_stock
          WHERE COALESCE(s.qty, 0) < r.requested_qty
          ORDER BY r.item_type_id
          LIMIT 1
        ),
        validation_errors AS (
          SELECT * FROM customer_error
          UNION ALL
          SELECT * FROM item_identity_error
          UNION ALL
          SELECT * FROM missing_item_error
          UNION ALL
          SELECT * FROM inactive_item_error
          UNION ALL
          SELECT * FROM stock_error
        ),
        validation_error AS (
          SELECT error_code, error_message
          FROM validation_errors
          ORDER BY priority
          LIMIT 1
        ),
        created_customer AS (
          INSERT INTO "Customer" ("name", "updatedAt")
          SELECT a.customer_name, NOW()
          FROM args a
          WHERE a.will_create_customer
            AND NOT EXISTS (SELECT 1 FROM validation_error)
          RETURNING id, "defaultKind"
        ),
        inserted_sale AS (
          INSERT INTO "Sale" (
            "saleDate",
            "customerId",
            "customerName",
            kind,
            "goodsTotal",
            discount,
            "grandTotal",
            "paidAmount",
            status,
            notes,
            "createdById",
            "updatedAt"
          )
          SELECT
            a.sale_date,
            COALESCE(ce.id, cc.id),
            CASE WHEN ce.id IS NULL AND cc.id IS NULL THEN a.one_time_name ELSE NULL END,
            COALESCE(a.kind_override, ce."defaultKind", cc."defaultKind", 'RETAIL'::"SaleKind"),
            a.goods_total,
            a.discount,
            a.grand_total,
            a.paid_amount,
            a.txn_status,
            a.notes,
            a.created_by_id,
            NOW()
          FROM args a
          LEFT JOIN customer_existing ce ON TRUE
          LEFT JOIN created_customer cc ON TRUE
          WHERE NOT EXISTS (SELECT 1 FROM validation_error)
          RETURNING id, "saleDate", "customerId"
        ),
        inserted_sale_lines AS (
          INSERT INTO "SaleLine" (
            "saleId",
            "itemTypeId",
            "itemName",
            qty,
            "unitPrice",
            "lineTotal",
            note
          )
          SELECT
            s.id,
            i.item_type_id,
            i.item_name,
            i.qty,
            i.unit_price,
            i.qty * i.unit_price,
            i.note
          FROM inserted_sale s
          CROSS JOIN items i
          ORDER BY i.ord
          RETURNING id
        ),
        inserted_inventory_event AS (
          INSERT INTO "InventoryEvent" (kind, "occurredAt", "saleId", "createdById")
          SELECT 'SALE'::"InventoryEventKind", a.sale_date, s.id, a.created_by_id
          FROM args a
          CROSS JOIN inserted_sale s
          WHERE EXISTS (SELECT 1 FROM catalog_requested)
          RETURNING id
        ),
        inserted_inventory_lines AS (
          INSERT INTO "InventoryLine" (
            "eventId",
            direction,
            location,
            "itemTypeId",
            qty
          )
          SELECT
            e.id,
            'OUT'::"InventoryDirection",
            'SHOP'::"Location",
            r.item_type_id,
            r.requested_qty
          FROM inserted_inventory_event e
          CROSS JOIN catalog_requested r
          RETURNING id
        ),
        inserted_payment AS (
          INSERT INTO "CustomerPayment" (
            "customerId",
            "saleId",
            amount,
            method,
            "paymentDate",
            "createdById"
          )
          SELECT
            s."customerId",
            s.id,
            a.paid_amount,
            a.payment_method,
            a.sale_date,
            a.created_by_id
          FROM args a
          CROSS JOIN inserted_sale s
          WHERE a.paid_amount > 0
          RETURNING id
        ),
        shortfalls AS (
          SELECT
            r.item_type_id,
            (r.requested_qty - GREATEST(COALESCE(s.qty, 0), 0))::int AS qty_beyond
          FROM catalog_requested r
          LEFT JOIN stock s ON s.item_type_id = r.item_type_id
          WHERE COALESCE(s.qty, 0) < r.requested_qty
        ),
        existing_open_exceptions AS (
          SELECT DISTINCT ON (sf.item_type_id)
            e.id,
            e."itemTypeId" AS item_type_id
          FROM shortfalls sf
          JOIN "StockException" e
            ON e."itemTypeId" = sf.item_type_id
           AND e.location = 'SHOP'::"Location"
           AND e.status = 'OPEN'::"StockExceptionStatus"
          WHERE NOT EXISTS (SELECT 1 FROM validation_error)
          ORDER BY sf.item_type_id, e.id
        ),
        updated_exceptions AS (
          UPDATE "StockException" e
          SET "lastDetectedAt" = a.sale_date,
              "updatedAt" = NOW()
          FROM existing_open_exceptions existing
          CROSS JOIN args a
          WHERE e.id = existing.id
          RETURNING e.id, e."itemTypeId" AS item_type_id
        ),
        inserted_exceptions AS (
          INSERT INTO "StockException" (
            "itemTypeId",
            location,
            "firstDetectedAt",
            "lastDetectedAt",
            "updatedAt"
          )
          SELECT
            sf.item_type_id,
            'SHOP'::"Location",
            a.sale_date,
            a.sale_date,
            NOW()
          FROM shortfalls sf
          CROSS JOIN args a
          WHERE NOT EXISTS (SELECT 1 FROM validation_error)
            AND NOT EXISTS (
              SELECT 1
              FROM existing_open_exceptions existing
              WHERE existing.item_type_id = sf.item_type_id
            )
          RETURNING id, "itemTypeId" AS item_type_id
        ),
        touched_exceptions AS (
          SELECT id, item_type_id FROM updated_exceptions
          UNION ALL
          SELECT id, item_type_id FROM inserted_exceptions
        ),
        inserted_exception_sales AS (
          INSERT INTO "StockExceptionSale" ("exceptionId", "saleId", "qtyBeyond")
          SELECT
            e.id,
            s.id,
            sf.qty_beyond
          FROM touched_exceptions e
          JOIN shortfalls sf ON sf.item_type_id = e.item_type_id
          CROSS JOIN inserted_sale s
          RETURNING id
        )
      SELECT
        NULL::int AS id,
        NULL::timestamp AS "saleDate",
        v.error_code AS "errorCode",
        v.error_message AS "errorMessage"
      FROM validation_error v

      UNION ALL

      SELECT
        s.id,
        s."saleDate",
        NULL::text AS "errorCode",
        NULL::text AS "errorMessage"
      FROM inserted_sale s

      LIMIT 1
    `);

    const row = rows[0];
    if (!row) throw new ConflictException("Sale could not be created");
    if (row.errorCode) {
      if (row.errorCode === "CUSTOMER_NOT_FOUND_OR_INACTIVE" || row.errorCode === "ITEM_NOT_FOUND") {
        throw new NotFoundException(row.errorMessage);
      }
      if (row.errorCode === "STOCK_SHORTAGE") {
        throw new ConflictException(row.errorMessage);
      }
      throw new BadRequestException(row.errorMessage);
    }
    if (row.id == null || row.saleDate == null) {
      throw new ConflictException("Sale could not be created");
    }
    return { id: row.id, saleDate: row.saleDate };
  }

  async list(q: ListSalesQueryDto): Promise<PageResult<unknown>> {
    const page = q.page ?? 1;
    const limit = q.limit ?? 50;
    const includeVoided = q.includeVoided === "true";
    const filters: Prisma.Sql[] = [];
    if (!includeVoided) filters.push(Prisma.sql`s."voidedAt" IS NULL`);
    if (q.customerId) filters.push(Prisma.sql`s."customerId" = ${q.customerId}`);
    if (q.status) filters.push(Prisma.sql`s.status = ${q.status}::"TxnStatus"`);
    if (q.kind) filters.push(Prisma.sql`s.kind = ${q.kind}::"SaleKind"`);
    if (q.fromDate) filters.push(Prisma.sql`s."saleDate" >= ${new Date(q.fromDate)}`);
    if (q.toDate) filters.push(Prisma.sql`s."saleDate" <= ${new Date(q.toDate)}`);
    const where = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SaleListSqlRow[]>(Prisma.sql`
      WITH filtered AS (
        SELECT
          s.id,
          s."saleDate",
          s."customerId",
          s."customerName",
          s.kind,
          s."goodsTotal",
          s.discount,
          s."grandTotal",
          s."paidAmount",
          s.status,
          s.notes,
          s."createdAt",
          s."updatedAt",
          s."voidedAt",
          s."voidReason",
          c.id AS customer_id,
          c.name AS customer_name,
          COUNT(*) OVER()::int AS total
        FROM "Sale" s
        LEFT JOIN "Customer" c ON c.id = s."customerId"
        ${where}
        ORDER BY s."saleDate" DESC
        OFFSET ${(page - 1) * limit}
        LIMIT ${limit}
      )
      SELECT
        f.id,
        f."saleDate",
        f."customerId",
        f."customerName",
        f.kind,
        f."goodsTotal",
        f.discount,
        f."grandTotal",
        f."paidAmount",
        f.status,
        f.notes,
        f."createdAt",
        f."updatedAt",
        f."voidedAt",
        f."voidReason",
        CASE
          WHEN f.customer_id IS NULL THEN NULL
          ELSE jsonb_build_object('id', f.customer_id, 'name', f.customer_name)
        END AS customer,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'itemTypeId', l."itemTypeId",
                'itemName', l."itemName",
                'qty', l.qty,
                'unitPrice', l."unitPrice",
                'lineTotal', l."lineTotal",
                'note', l.note
              )
              ORDER BY l.id
            )
            FROM "SaleLine" l
            WHERE l."saleId" = f.id
          ),
          '[]'::jsonb
        ) AS lines,
        f.total
      FROM filtered f
      ORDER BY f."saleDate" DESC
    `);

    return {
      data: rows.map((r) => ({
        ...r,
        lines: Array.isArray(r.lines) ? r.lines : [],
      })),
      page,
      limit,
      total: rows[0]?.total ?? 0,
    };
  }

  async getOne(id: number) {
    const [sale] = await this.prisma.$queryRaw<SaleDetailSqlRow[]>(Prisma.sql`
      SELECT
        s.id,
        s."saleDate",
        s."customerId",
        s."customerName",
        s.kind,
        s."goodsTotal",
        s.discount,
        s."grandTotal",
        s."paidAmount",
        s.status,
        s.notes,
        s."createdById",
        s."createdAt",
        s."updatedAt",
        s."voidedAt",
        s."voidedById",
        s."voidReason",
        CASE
          WHEN c.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', c.id,
            'name', c.name,
            'contact', c.contact,
            'photoUrl', c."photoUrl",
            'defaultKind', c."defaultKind",
            'notes', c.notes,
            'status', c.status
          )
        END AS customer,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'itemTypeId', l."itemTypeId",
                'itemName', l."itemName",
                'qty', l.qty,
                'unitPrice', l."unitPrice",
                'lineTotal', l."lineTotal",
                'note', l.note,
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
            FROM "SaleLine" l
            LEFT JOIN "ItemType" t ON t.id = l."itemTypeId"
            WHERE l."saleId" = s.id
          ),
          '[]'::jsonb
        ) AS lines,
        COALESCE(
          (
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', p.id,
                'amount', p.amount,
                'paymentDate', p."paymentDate",
                'method', p.method,
                'notes', p.notes
              )
              ORDER BY p."paymentDate" ASC, p.id ASC
            )
            FROM "CustomerPayment" p
            WHERE p."saleId" = s.id
              AND p."voidedAt" IS NULL
          ),
          '[]'::jsonb
        ) AS payments,
        jsonb_build_object(
          'id', cb.id,
          'username', cb.username,
          'displayName', cb."displayName"
        ) AS "createdBy",
        CASE
          WHEN vb.id IS NULL THEN NULL
          ELSE jsonb_build_object(
            'id', vb.id,
            'username', vb.username,
            'displayName', vb."displayName"
          )
        END AS "voidedBy"
      FROM "Sale" s
      LEFT JOIN "Customer" c ON c.id = s."customerId"
      JOIN "User" cb ON cb.id = s."createdById"
      LEFT JOIN "User" vb ON vb.id = s."voidedById"
      WHERE s.id = ${id}
      LIMIT 1
    `);
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return {
      ...sale,
      lines: jsonArray(sale.lines),
      payments: jsonArray(sale.payments),
    };
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
   * Add-on: append more line items to a posted sale so it stays a single
   * receipt (e.g. the buyer comes back 5 minutes later for 5 more). Deducts shop
   * stock via a SALE event (physical-truth, same as a normal sale), bumps the
   * sale totals, and records the cash taken now as a CustomerPayment.
   */
  async addItems(saleId: number, dto: AddItemsDto, createdById: number) {
    for (const it of dto.items) {
      if (it.itemTypeId === undefined && !it.itemName?.trim()) {
        throw new BadRequestException("Each item needs an itemTypeId or itemName");
      }
    }
    const addedGoods = dto.items.reduce((s, i) => s + i.unitPrice * i.qty, 0);
    const paidNow = dto.paidAmount ?? 0;
    if (paidNow > addedGoods) {
      throw new BadRequestException("Paid amount cannot exceed the added items total");
    }

    await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id: saleId } });
      if (!sale) throw new NotFoundException(`Sale ${saleId} not found`);
      if (sale.voidedAt) throw new ConflictException("Cannot add to a voided sale");
      if (sale.customerId == null && paidNow !== addedGoods) {
        throw new BadRequestException("A walk-in sale's add-on must be paid in full");
      }

      await tx.saleLine.createMany({
        data: dto.items.map((i) => ({
          saleId,
          itemTypeId: i.itemTypeId ?? null,
          itemName: i.itemTypeId !== undefined ? null : i.itemName?.trim() || null,
          qty: i.qty,
          unitPrice: i.unitPrice,
          lineTotal: i.unitPrice * i.qty,
          note: i.note?.trim() || null,
        })),
      });

      // Deduct shop stock for catalog items (ad-hoc itemName lines aren't tracked).
      const outLines = dto.items
        .filter((i) => i.itemTypeId !== undefined)
        .map((i) => ({
          direction: "OUT" as const,
          location: "SHOP" as const,
          itemTypeId: i.itemTypeId!,
          qty: i.qty,
        }));
      if (outLines.length > 0) {
        await tx.inventoryEvent.create({
          data: { kind: "SALE", saleId, createdById, lines: { create: outLines } },
        });
      }

      const newGrand = sale.grandTotal + addedGoods;
      const newPaid = sale.paidAmount + paidNow;
      await tx.sale.update({
        where: { id: saleId },
        data: {
          goodsTotal: sale.goodsTotal + addedGoods,
          grandTotal: newGrand,
          paidAmount: newPaid,
          status: statusFor(newGrand, newPaid),
        },
      });

      if (paidNow > 0) {
        await tx.customerPayment.create({
          data: { customerId: sale.customerId, saleId, amount: paidNow, method: "CASH", createdById },
        });
      }
    });

    return this.getOne(saleId);
  }

  /**
   * Void a sale: reverses everything tied to it — the SALE stock event, its
   * customer payments, AND any returns recorded against it (with their
   * RETURN_FROM_CUSTOMER stock events). Stock & balances self-correct because
   * aggregations exclude voided rows.
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

      // Reverse any returns recorded against this sale (and their stock-in
      // events) — otherwise the returned goods would be counted into stock twice
      // and the customer balance would be wrong once the sale is gone.
      const returns = await tx.saleReturn.findMany({
        where: { saleId: sale.id, voidedAt: null },
        select: { id: true, eventId: true },
      });
      if (returns.length > 0) {
        await tx.saleReturn.updateMany({
          where: { saleId: sale.id, voidedAt: null },
          data: { voidedAt: now, voidedById, voidReason: `Sale #${sale.id} voided: ${reason}` },
        });
        const returnEventIds = returns
          .map((r) => r.eventId)
          .filter((id): id is number => id != null);
        if (returnEventIds.length > 0) {
          await tx.inventoryEvent.updateMany({
            where: { id: { in: returnEventIds } },
            data: { voidedAt: now, voidedById, voidReason: `Sale #${sale.id} voided: ${reason}` },
          });
        }
      }

      return tx.sale.findUnique({
        where: { id: sale.id },
        include: { lines: { include: { itemType: true } }, payments: true },
      });
    });
  }
}
