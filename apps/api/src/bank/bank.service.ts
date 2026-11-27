import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { PaymentBank } from "../common/payment-parts";
import { CreateBankTxnDto } from "./dto/bank.dto";

export interface BankAccount {
  bank: string;
  /** What the records say the account holds now. */
  balance: number;
  /** The last manual "balance is X" point (null = never set; balance then runs from 0 over all history). */
  setAt: string | null;
  setAmount: number | null;
  /** Movements counted on top of the set point. */
  in: number;
  out: number;
}

export interface BankRow {
  /** Unique across sources, e.g. "TXN-12", "CUST-88". */
  key: string;
  /** Set only for manual rows (BankTxn) — those can be removed. */
  txnId: number | null;
  bank: string;
  /** CUSTOMER | SUPPLIER | TAILOR | EXPENSE | DEPOSIT | WITHDRAW | SET_BALANCE */
  kind: string;
  date: string;
  /** + in, − out. For SET_BALANCE this is 0 and `balanceAfter` is the set amount. */
  signed: number;
  amount: number;
  cashSide: boolean | null;
  who: string | null;
  notes: string | null;
  /** Balance after this row (null for rows older than the bank's last set point). */
  balanceAfter: number | null;
}

export interface BankOverview {
  accounts: BankAccount[];
  /** Sum of the banks whose balance has been set (unset banks and the "unknown bank" bucket are left out). */
  total: number;
  /** Non-cash money recorded without a bank — it cannot be placed in any account. */
  unassigned: { in: number; out: number };
  rows: BankRow[];
}

const NAMED = Object.values(PaymentBank).filter((b) => b !== PaymentBank.UNKNOWN) as string[];
const ROW_LIMIT = 300;

/**
 * Every non-cash movement, one row each: bank, when, signed amount.
 * "When" is the moment it was ENTERED if it is dated the same Yangon day —
 * many records carry a date only (stored as that day's start), which would
 * otherwise sort before a balance set earlier the same day and be skipped.
 * A record dated on another day keeps its own date.
 * A missing bank falls into 'UNKNOWN'. SET_BALANCE rows carry signed = 0.
 */
const MOVEMENTS = Prisma.sql`
  SELECT 'CUST-' || p.id AS key, NULL::int AS "txnId", COALESCE(p.bank, 'UNKNOWN') AS bank, 'CUSTOMER' AS kind,
         CASE WHEN (p."paymentDate" + interval '390 minutes')::date = (p."createdAt" + interval '390 minutes')::date THEN p."createdAt" ELSE p."paymentDate" END AS ts, p.amount AS signed, p.amount AS amount, NULL::boolean AS "cashSide",
         c.name AS who, p.notes AS notes
  FROM "CustomerPayment" p
  LEFT JOIN "Sale" sl ON sl.id = p."saleId"
  LEFT JOIN "Customer" c ON c.id = COALESCE(p."customerId", sl."customerId")
  WHERE p."voidedAt" IS NULL AND p.method::text <> 'CASH'
  UNION ALL
  SELECT 'SUPP-' || p.id, NULL, COALESCE(p.bank, 'UNKNOWN'), 'SUPPLIER', CASE WHEN (p."paymentDate" + interval '390 minutes')::date = (p."createdAt" + interval '390 minutes')::date THEN p."createdAt" ELSE p."paymentDate" END, -p.amount, p.amount, NULL,
         s.name, p.notes
  FROM "SupplierPayment" p LEFT JOIN "Supplier" s ON s.id = p."supplierId"
  WHERE p."voidedAt" IS NULL AND p.method::text <> 'CASH'
  UNION ALL
  SELECT 'TAIL-' || p.id, NULL, COALESCE(p.bank, 'UNKNOWN'), 'TAILOR', CASE WHEN (p."paymentDate" + interval '390 minutes')::date = (p."createdAt" + interval '390 minutes')::date THEN p."createdAt" ELSE p."paymentDate" END, -p.amount, p.amount, NULL,
         t.name, p.notes
  FROM "TailorPayment" p LEFT JOIN "Tailor" t ON t.id = p."tailorId"
  WHERE p."voidedAt" IS NULL AND p.method::text <> 'CASH'
  UNION ALL
  SELECT 'EXP-' || e.id, NULL, COALESCE(e.bank, 'UNKNOWN'), 'EXPENSE', CASE WHEN (e."expenseDate" + interval '390 minutes')::date = (e."createdAt" + interval '390 minutes')::date THEN e."createdAt" ELSE e."expenseDate" END, -e.amount, e.amount, NULL,
         ec."labelMy", e.notes
  FROM "Expense" e LEFT JOIN "ExpenseCategory" ec ON ec.id = e."categoryId"
  WHERE e."voidedAt" IS NULL AND e.method::text <> 'CASH'
  UNION ALL
  SELECT 'TXN-' || b.id, b.id, b.bank, b.type, CASE WHEN (b."txnDate" + interval '390 minutes')::date = (b."createdAt" + interval '390 minutes')::date THEN b."createdAt" ELSE b."txnDate" END,
         CASE b.type WHEN 'DEPOSIT' THEN b.amount WHEN 'WITHDRAW' THEN -b.amount ELSE 0 END,
         b.amount, b."cashSide", NULL, b.notes
  FROM "BankTxn" b WHERE b."voidedAt" IS NULL
`;

/**
 * The bank book: what each bank account should hold according to the records.
 *
 * balance = last manual set point + every non-cash movement recorded after it
 * (customer transfers in; supplier / tailor / expense transfers out; manual
 * deposits and withdrawals). Without a set point the balance simply runs from
 * zero over the whole history, which is rarely the real figure — the admin is
 * expected to set it once from the bank app.
 */
@Injectable()
export class BankService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(bank?: string): Promise<BankOverview> {
    const only = bank && (NAMED.includes(bank) || bank === "UNKNOWN") ? bank : null;

    const sums = await this.prisma.$queryRaw<
      { bank: string; setAt: Date | null; setAmount: number | null; in: number; out: number }[]
    >(Prisma.sql`
      WITH anchor AS (
        SELECT DISTINCT ON (bank) bank, amount, "txnDate"
        FROM "BankTxn" WHERE type = 'SET_BALANCE' AND "voidedAt" IS NULL
        ORDER BY bank, "txnDate" DESC, id DESC
      ), mv AS (${MOVEMENTS})
      SELECT b.bank, a."txnDate" AS "setAt", a.amount AS "setAmount",
             COALESCE(SUM(mv.signed) FILTER (WHERE mv.signed > 0 AND (a.bank IS NULL OR mv.ts > a."txnDate")), 0)::float8 AS "in",
             COALESCE(-SUM(mv.signed) FILTER (WHERE mv.signed < 0 AND (a.bank IS NULL OR mv.ts > a."txnDate")), 0)::float8 AS "out"
      FROM (SELECT DISTINCT bank FROM mv) b
      LEFT JOIN anchor a ON a.bank = b.bank
      LEFT JOIN mv ON mv.bank = b.bank
      GROUP BY b.bank, a."txnDate", a.amount
    `);
    const byBank = new Map(sums.map((s) => [s.bank, s]));

    const accounts: BankAccount[] = NAMED.map((code) => {
      const s = byBank.get(code);
      const setAmount = s?.setAmount ?? null;
      const inn = Number(s?.in ?? 0);
      const out = Number(s?.out ?? 0);
      return {
        bank: code,
        balance: (setAmount ?? 0) + inn - out,
        setAt: s?.setAt ? s.setAt.toISOString() : null,
        setAmount,
        in: inn,
        out,
      };
    });
    const unknown = byBank.get("UNKNOWN");

    const raw = await this.prisma.$queryRaw<
      {
        key: string;
        txnId: number | null;
        bank: string;
        kind: string;
        ts: Date;
        signed: number;
        amount: number;
        cashSide: boolean | null;
        who: string | null;
        notes: string | null;
      }[]
    >(Prisma.sql`
      SELECT * FROM (${MOVEMENTS}) mv
      ${only ? Prisma.sql`WHERE mv.bank = ${only}` : Prisma.empty}
      ORDER BY mv.ts DESC, mv.key DESC
      LIMIT ${ROW_LIMIT}
    `);

    // Walk each bank's rows newest → oldest, peeling movements off the current
    // balance. A set point fixes the balance at that moment; what the account
    // held before it is not known, so older rows carry no balance.
    const running = new Map<string, number | null>(accounts.map((a) => [a.bank, a.balance]));
    const rows: BankRow[] = raw.map((r) => {
      const signed = Number(r.signed);
      const cur = running.get(r.bank) ?? null;
      let balanceAfter: number | null = cur;
      if (r.kind === "SET_BALANCE") {
        // Only the latest set point is live; an older one sits in unknown territory.
        balanceAfter = cur === null ? null : Number(r.amount);
        running.set(r.bank, null);
      } else if (cur !== null) {
        running.set(r.bank, cur - signed);
      }
      return {
        key: r.key,
        txnId: r.txnId,
        bank: r.bank,
        kind: r.kind,
        date: r.ts.toISOString(),
        signed,
        amount: Number(r.amount),
        cashSide: r.cashSide,
        who: r.who,
        notes: r.notes,
        balanceAfter,
      };
    });

    return {
      accounts,
      // Only banks whose balance has been set — an unset one is not a real figure.
      total: accounts.reduce((s, a) => s + (a.setAt ? a.balance : 0), 0),
      unassigned: { in: Number(unknown?.in ?? 0), out: Number(unknown?.out ?? 0) },
      rows,
    };
  }

  async create(dto: CreateBankTxnDto, userId: number) {
    if (dto.bank === PaymentBank.UNKNOWN) throw new BadRequestException("Choose a bank");
    if (dto.type !== "SET_BALANCE" && dto.amount < 1) throw new BadRequestException("Amount must be more than 0");
    const now = new Date();
    let txnDate = now;
    if (dto.type !== "SET_BALANCE" && dto.txnDate) {
      txnDate = new Date(dto.txnDate);
      if (txnDate.getTime() > now.getTime()) txnDate = now;
    }
    return this.prisma.bankTxn.create({
      data: {
        bank: dto.bank,
        type: dto.type,
        amount: dto.amount,
        cashSide: dto.type === "SET_BALANCE" ? false : (dto.cashSide ?? true),
        txnDate,
        notes: dto.notes?.trim() || null,
        createdById: userId,
      },
    });
  }

  async void(id: number, userId: number) {
    const t = await this.prisma.bankTxn.findUnique({ where: { id } });
    if (!t) throw new NotFoundException(`Bank entry ${id} not found`);
    if (t.voidedAt) return t;
    return this.prisma.bankTxn.update({ where: { id }, data: { voidedAt: new Date(), voidedById: userId } });
  }
}
