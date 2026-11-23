import { Injectable } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { addDays, startOfTodayYangon, toYangonYmd, ymdToYangonStart } from "../common/yangon-time";

/** A balance held as physical cash vs. in bank accounts / wallets. */
export interface MoneySplit {
  total: number;
  cash: number;
  bank: number;
}

export interface MoneyDay {
  date: string; // YYYY-MM-DD (Yangon)
  opening: number;
  in: number;
  inCash: number;
  inBank: number;
  out: number;
  outCash: number;
  outBank: number;
  supplier: number;
  tailor: number;
  expense: number;
  refund: number;
  net: number;
  closing: number;
  closingCash: number;
  closingBank: number;
}

export interface MoneyOverview {
  from: string;
  to: string;
  /** First day any money was recorded in this shop (null = nothing yet). */
  firstDay: string | null;
  opening: MoneySplit;
  closing: MoneySplit;
  totals: {
    in: number;
    inCash: number;
    inBank: number;
    /** Paid at the time of a sale. */
    inSale: number;
    /** Old debts collected. */
    inDebt: number;
    out: number;
    outCash: number;
    outBank: number;
    supplier: number;
    tailor: number;
    expense: number;
    refund: number;
    net: number;
  };
  /** Money received in range, by where it landed (CASH | bank code | NOBANK). */
  channels: { channel: string; total: number; count: number }[];
  expenseCategories: { name: string; value: number }[];
  days: MoneyDay[];
}

type Row = { day: string; kind: string; channel: string; amount: number; n: number };

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 366;

/**
 * The money book: every kyat recorded as received or paid out, day by day, with
 * a running balance. This is the BOOK balance — what the records say should be
 * on hand — and is independent of the staff app's drawer count (DailyClose).
 *
 * In  = customer payments (at a sale, or against debt), every method.
 * Out = supplier payments + tailor payments + expenses + cash refunds.
 * Expenses and refunds carry no method, so they count as cash (same rule as the
 * daily close).
 */
@Injectable()
export class MoneyService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(q: { from?: string; to?: string } = {}): Promise<MoneyOverview> {
    const today = toYangonYmd(startOfTodayYangon());
    const asYmd = (v: string | undefined): string | undefined => {
      if (!v) return undefined;
      if (YMD.test(v)) return v;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? undefined : toYangonYmd(d);
    };

    // One row per (Yangon day, kind, channel) over the shop's whole history —
    // the running balance needs everything before the range anyway, and this
    // stays a few thousand rows at most.
    const rows = await this.prisma.$queryRaw<Row[]>(Prisma.sql`
      SELECT to_char(d, 'YYYY-MM-DD') AS day, kind, channel,
             SUM(amount)::float8 AS amount, COUNT(*)::int AS n
      FROM (
        SELECT ("paymentDate" + interval '390 minutes')::date AS d,
               CASE WHEN "saleId" IS NULL THEN 'IN_DEBT' ELSE 'IN_SALE' END AS kind,
               CASE WHEN method::text = 'CASH' THEN 'CASH' ELSE COALESCE(bank, 'NOBANK') END AS channel,
               amount
        FROM "CustomerPayment" WHERE "voidedAt" IS NULL
        UNION ALL
        SELECT ("paymentDate" + interval '390 minutes')::date, 'SUPPLIER',
               CASE WHEN method::text = 'CASH' THEN 'CASH' ELSE 'BANK' END, amount
        FROM "SupplierPayment" WHERE "voidedAt" IS NULL
        UNION ALL
        SELECT ("paymentDate" + interval '390 minutes')::date, 'TAILOR',
               CASE WHEN method::text = 'CASH' THEN 'CASH' ELSE 'BANK' END, amount
        FROM "TailorPayment" WHERE "voidedAt" IS NULL
        UNION ALL
        SELECT ("expenseDate" + interval '390 minutes')::date, 'EXPENSE', 'CASH', amount
        FROM "Expense" WHERE "voidedAt" IS NULL
        UNION ALL
        SELECT ("returnDate" + interval '390 minutes')::date, 'REFUND', 'CASH', "refundAmount"
        FROM "SaleReturn" WHERE "voidedAt" IS NULL AND "refundAmount" > 0
      ) m
      GROUP BY 1, 2, 3
      ORDER BY 1
    `);

    const firstDay = rows.length > 0 ? rows[0]!.day : null;
    let to = asYmd(q.to) ?? today;
    let from = asYmd(q.from) ?? firstDay ?? to;
    if (from > to) [from, to] = [to, from];
    // Keep the page bounded: at most a year of days, ending at `to`.
    const earliest = toYangonYmd(addDays(ymdToYangonStart(to), -(MAX_DAYS - 1)));
    if (from < earliest) from = earliest;

    const blank = (date: string): MoneyDay => ({
      date,
      opening: 0,
      in: 0,
      inCash: 0,
      inBank: 0,
      out: 0,
      outCash: 0,
      outBank: 0,
      supplier: 0,
      tailor: 0,
      expense: 0,
      refund: 0,
      net: 0,
      closing: 0,
      closingCash: 0,
      closingBank: 0,
    });
    const dayMap = new Map<string, MoneyDay>();
    for (let d = ymdToYangonStart(from), i = 0; i < MAX_DAYS; i++, d = addDays(d, 1)) {
      const ymd = toYangonYmd(d);
      if (ymd > to) break;
      dayMap.set(ymd, blank(ymd));
    }

    const opening: MoneySplit = { total: 0, cash: 0, bank: 0 };
    const totals: MoneyOverview["totals"] = {
      in: 0,
      inCash: 0,
      inBank: 0,
      inSale: 0,
      inDebt: 0,
      out: 0,
      outCash: 0,
      outBank: 0,
      supplier: 0,
      tailor: 0,
      expense: 0,
      refund: 0,
      net: 0,
    };
    const channelMap = new Map<string, { total: number; count: number }>();

    for (const r of rows) {
      if (r.day > to) continue;
      const amount = Number(r.amount) || 0;
      const isIn = r.kind === "IN_SALE" || r.kind === "IN_DEBT";
      const isCash = r.channel === "CASH";
      const signed = isIn ? amount : -amount;
      if (r.day < from) {
        opening.total += signed;
        if (isCash) opening.cash += signed;
        else opening.bank += signed;
        continue;
      }
      const day = dayMap.get(r.day);
      if (!day) continue;
      if (isIn) {
        day.in += amount;
        totals.in += amount;
        if (isCash) {
          day.inCash += amount;
          totals.inCash += amount;
        } else {
          day.inBank += amount;
          totals.inBank += amount;
        }
        if (r.kind === "IN_SALE") totals.inSale += amount;
        else totals.inDebt += amount;
        const c = channelMap.get(r.channel) ?? { total: 0, count: 0 };
        c.total += amount;
        c.count += r.n;
        channelMap.set(r.channel, c);
      } else {
        day.out += amount;
        totals.out += amount;
        if (isCash) {
          day.outCash += amount;
          totals.outCash += amount;
        } else {
          day.outBank += amount;
          totals.outBank += amount;
        }
        const key =
          r.kind === "SUPPLIER"
            ? "supplier"
            : r.kind === "TAILOR"
              ? "tailor"
              : r.kind === "EXPENSE"
                ? "expense"
                : "refund";
        day[key] += amount;
        totals[key] += amount;
      }
    }
    totals.net = totals.in - totals.out;

    const days = [...dayMap.values()];
    const run = { ...opening };
    for (const d of days) {
      d.opening = run.total;
      d.net = d.in - d.out;
      run.total += d.net;
      run.cash += d.inCash - d.outCash;
      run.bank += d.inBank - d.outBank;
      d.closing = run.total;
      d.closingCash = run.cash;
      d.closingBank = run.bank;
    }

    const cats = await this.prisma.expense.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      where: {
        voidedAt: null,
        expenseDate: { gte: ymdToYangonStart(from), lt: addDays(ymdToYangonStart(to), 1) },
      },
    });
    const catNames = new Map(
      (await this.prisma.expenseCategory.findMany({ select: { id: true, labelMy: true } })).map(
        (c) => [c.id, c.labelMy] as const,
      ),
    );
    const expenseCategories = cats
      .map((c) => ({ name: catNames.get(c.categoryId) ?? "—", value: c._sum.amount ?? 0 }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);

    const channels = [...channelMap.entries()]
      .map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.total - a.total);

    return {
      from,
      to,
      firstDay,
      opening,
      closing: { ...run },
      totals,
      channels,
      expenseCategories,
      days,
    };
  }
}
