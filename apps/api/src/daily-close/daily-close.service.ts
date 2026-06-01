import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
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

    const existing = await this.prisma.dailyClose.findUnique({ where: { closeDate: dayStart } });
    const previousClose = await this.prisma.dailyClose.findFirst({
      where: { closeDate: { lt: dayStart } },
      orderBy: { closeDate: "desc" },
    });
    // Opening = what was deliberately kept in the drawer at the previous close
    // (the rest was taken home). Defaults to 0 when nothing was kept / no prior close.
    const openingCash = previousClose?.carryForward ?? 0;

    // Customer payments NOT tied to a sale (general debt-reduction payments) +
    // sale paid-now amounts (recorded as customer payments with saleId set).
    // We just sum *all* non-voided CustomerPayment in the window; this naturally
    // includes both flavours because POST /sales also creates a CustomerPayment.
    const [custPay, suppPay, tailorPay, expenses, refundsAgg] = await Promise.all([
      this.prisma.customerPayment.aggregate({
        where: { voidedAt: null, paymentDate: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.supplierPayment.aggregate({
        where: { voidedAt: null, paymentDate: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.tailorPayment.aggregate({
        where: { voidedAt: null, paymentDate: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { voidedAt: null, expenseDate: { gte: dayStart, lt: dayEnd } },
        _sum: { amount: true },
      }),
      this.prisma.saleReturn.aggregate({
        where: { voidedAt: null, returnDate: { gte: dayStart, lt: dayEnd } },
        _sum: { refundAmount: true },
      }),
    ]);

    const customerPayments = custPay._sum.amount ?? 0;
    const supplierPayments = suppPay._sum.amount ?? 0;
    const tailorPayments = tailorPay._sum.amount ?? 0;
    const expenseTotal = expenses._sum.amount ?? 0;
    const refunds = refundsAgg._sum.refundAmount ?? 0;

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
      alreadyClosed: !!existing,
    };
  }

  async create(dto: CreateDailyCloseDto, closedById: number) {
    const dayStart = ymdToYangonStart(dto.date);

    const existing = await this.prisma.dailyClose.findUnique({ where: { closeDate: dayStart } });
    if (existing) {
      throw new ConflictException(`A close already exists for ${dto.date}`);
    }

    const preview = await this.preview(dto.date);
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
