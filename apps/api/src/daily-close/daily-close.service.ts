import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { addDays, startOfTodayYangon, toYangonYmd, ymdToYangonStart } from "../common/yangon-time";
import { CreateDailyCloseDto } from "./dto/daily-close.dto";

export interface DailyClosePreview {
  date: string; // YYYY-MM-DD Yangon
  openingCash: number;
  receivedTotal: number;
  paidOutTotal: number;
  expectedCash: number;
  receivedBreakdown: { customerPayments: number; salePaidNow: number };
  paidOutBreakdown: {
    supplierPayments: number;
    tailorPayments: number;
    expenses: number;
    refunds: number;
  };
  alreadyClosed: boolean;
}

type DailyClosePreviewSqlRow = {
  openingCash: number;
  customerPayments: number;
  supplierPayments: number;
  tailorPayments: number;
  expenses: number;
  refunds: number;
  alreadyClosed: boolean;
};

@Injectable()
export class DailyCloseService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute (but do NOT persist) what a close on a given Yangon day would look like.
   * Frozen at compute time so callers can show "expected vs counted" before saving.
   */
  async preview(date?: string): Promise<DailyClosePreview> {
    const dayStart = date ? ymdToYangonStart(date) : startOfTodayYangon();
    const dayEnd = addDays(dayStart, 1);
    const ymd = date ?? toYangonYmd(dayStart);

    const [row] = await this.prisma.$queryRaw<DailyClosePreviewSqlRow[]>(Prisma.sql`
      WITH args AS (
        SELECT ${dayStart}::timestamp(3) AS day_start, ${dayEnd}::timestamp(3) AS day_end
      )
      SELECT
        COALESCE(
          (
            SELECT dc."carryForward"
            FROM "DailyClose" dc, args
            WHERE dc."closeDate" < args.day_start
            ORDER BY dc."closeDate" DESC
            LIMIT 1
          ),
          0
        )::int AS "openingCash",
        COALESCE(
          (
            SELECT SUM(cp.amount)
            FROM "CustomerPayment" cp, args
            WHERE cp."voidedAt" IS NULL
              AND cp."paymentDate" >= args.day_start
              AND cp."paymentDate" < args.day_end
          ),
          0
        )::int AS "customerPayments",
        COALESCE(
          (
            SELECT SUM(sp.amount)
            FROM "SupplierPayment" sp, args
            WHERE sp."voidedAt" IS NULL
              AND sp."paymentDate" >= args.day_start
              AND sp."paymentDate" < args.day_end
          ),
          0
        )::int AS "supplierPayments",
        COALESCE(
          (
            SELECT SUM(tp.amount)
            FROM "TailorPayment" tp, args
            WHERE tp."voidedAt" IS NULL
              AND tp."paymentDate" >= args.day_start
              AND tp."paymentDate" < args.day_end
          ),
          0
        )::int AS "tailorPayments",
        COALESCE(
          (
            SELECT SUM(e.amount)
            FROM "Expense" e, args
            WHERE e."voidedAt" IS NULL
              AND e."expenseDate" >= args.day_start
              AND e."expenseDate" < args.day_end
          ),
          0
        )::int AS expenses,
        COALESCE(
          (
            SELECT SUM(sr."refundAmount")
            FROM "SaleReturn" sr, args
            WHERE sr."voidedAt" IS NULL
              AND sr."returnDate" >= args.day_start
              AND sr."returnDate" < args.day_end
          ),
          0
        )::int AS refunds,
        EXISTS (
          SELECT 1
          FROM "DailyClose" dc, args
          WHERE dc."closeDate" = args.day_start
        ) AS "alreadyClosed"
    `);

    const openingCash = row?.openingCash ?? 0;
    const customerPayments = row?.customerPayments ?? 0;
    const supplierPayments = row?.supplierPayments ?? 0;
    const tailorPayments = row?.tailorPayments ?? 0;
    const expenseTotal = row?.expenses ?? 0;
    const refunds = row?.refunds ?? 0;

    const receivedTotal = customerPayments;
    const paidOutTotal = supplierPayments + tailorPayments + expenseTotal + refunds;
    const expectedCash = openingCash + receivedTotal - paidOutTotal;

    return {
      date: ymd,
      openingCash,
      receivedTotal,
      paidOutTotal,
      expectedCash,
      receivedBreakdown: {
        customerPayments,
        // V1: sale paid-now is rolled into customerPayments (since /sales creates
        // one) so we surface 0 here. Kept as a field for clarity / future use.
        salePaidNow: 0,
      },
      paidOutBreakdown: {
        supplierPayments,
        tailorPayments,
        expenses: expenseTotal,
        refunds,
      },
      alreadyClosed: row?.alreadyClosed ?? false,
    };
  }

  async create(dto: CreateDailyCloseDto, closedById: number) {
    const dayStart = ymdToYangonStart(dto.date);

    const preview = await this.preview(dto.date);
    if (preview.alreadyClosed) throw new ConflictException(`A close already exists for ${dto.date}`);
    const difference = dto.countedCash - preview.expectedCash;
    const carryForward = dto.carryForward ?? 0;
    if (carryForward > dto.countedCash) {
      throw new BadRequestException("Cannot keep more than the counted cash");
    }

    return this.prisma.dailyClose.create({
      data: {
        closeDate: dayStart,
        openingCash: preview.openingCash,
        receivedTotal: preview.receivedTotal,
        paidOutTotal: preview.paidOutTotal,
        expectedCash: preview.expectedCash,
        countedCash: dto.countedCash,
        carryForward,
        difference,
        notes: dto.notes,
        closedById,
      },
    });
  }

  async list(range: { from?: string; to?: string } = {}, limit = 120) {
    const rows = await this.prisma.dailyClose.findMany({
      where:
        range.from || range.to
          ? {
              closeDate: {
                ...(range.from ? { gte: new Date(range.from) } : {}),
                ...(range.to ? { lte: new Date(range.to) } : {}),
              },
            }
          : {},
      orderBy: { closeDate: "desc" },
      take: limit,
      include: { closedBy: { select: { id: true, displayName: true } } },
    });
    // closeDate is stored at Yangon midnight (the previous calendar day in UTC),
    // so a raw ISO slice is a day early. Expose the real Yangon business date.
    return rows.map((r) => ({ ...r, date: toYangonYmd(r.closeDate) }));
  }
}
