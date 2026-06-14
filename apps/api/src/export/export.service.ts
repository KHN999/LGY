import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { addDays, toYangonYmd } from "../common/yangon-time";

export interface StatementTxn {
  date: string;
  type: string;
  description: string;
  in: number;
  out: number;
  balance: number;
}
export interface Statement {
  from: string;
  to: string;
  openingCash: number;
  closingCash: number;
  totalIn: number;
  totalOut: number;
  salesTotal: number;
  salesCount: number;
  transactions: StatementTxn[];
}

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bank-statement-style cash ledger for a period (active shop). Opening balance
   *  is the carry-forward from the last close before the period; running balance
   *  threads through every cash movement (payments in, supplier/tailor/expense/
   *  refund out). */
  async statement(fromStr: string | undefined, toStr: string): Promise<Statement> {
    // The DateFilter sends full ISO instants (Yangon-anchored, end-of-day for
    // `to`); a bare YYYY-MM-DD means "the whole of that day". No `from` means
    // all-time — the complete ledger from a zero opening balance.
    const from = fromStr ? new Date(fromStr) : undefined;
    const upper = toStr.includes("T") ? { lte: new Date(toStr) } : { lt: addDays(new Date(toStr), 1) };
    const range = from ? { gte: from, ...upper } : upper;

    const [opening, custPays, supPays, tailPays, expenses, returns, sales] = await Promise.all([
      from
        ? this.prisma.dailyClose.findFirst({
            where: { closeDate: { lt: from } },
            orderBy: { closeDate: "desc" },
            select: { carryForward: true },
          })
        : Promise.resolve(null),
      // CASH only — this is a cash-drawer ledger that must reconcile with the
      // daily close (which counts cash). Bank transfers never hit the drawer, so
      // they're excluded here (see the dashboard's Cash/Bank split for those).
      this.prisma.customerPayment.findMany({
        where: { voidedAt: null, method: "CASH", paymentDate: range },
        select: { paymentDate: true, amount: true, saleId: true, customer: { select: { name: true } } },
      }),
      this.prisma.supplierPayment.findMany({
        where: { voidedAt: null, method: "CASH", paymentDate: range },
        select: { paymentDate: true, amount: true, supplier: { select: { name: true } } },
      }),
      this.prisma.tailorPayment.findMany({
        where: { voidedAt: null, method: "CASH", paymentDate: range },
        select: { paymentDate: true, amount: true, tailor: { select: { name: true } } },
      }),
      this.prisma.expense.findMany({
        where: { voidedAt: null, expenseDate: range },
        select: { expenseDate: true, amount: true, paidTo: true, category: { select: { labelMy: true } } },
      }),
      this.prisma.saleReturn.findMany({
        where: { voidedAt: null, returnDate: range, refundAmount: { gt: 0 } },
        select: { returnDate: true, refundAmount: true, saleId: true },
      }),
      this.prisma.sale.findMany({
        where: { voidedAt: null, saleDate: range },
        select: { grandTotal: true },
      }),
    ]);

    const openingCash = opening?.carryForward ?? 0;
    type Raw = { date: Date; type: string; description: string; in: number; out: number };
    const raw: Raw[] = [
      ...custPays.map((p) => ({ date: p.paymentDate, type: "Payment received", description: `${p.customer?.name ?? "Walk-in"}${p.saleId ? ` (sale #${p.saleId})` : ""}`, in: p.amount, out: 0 })),
      ...supPays.map((p) => ({ date: p.paymentDate, type: "Supplier payment", description: p.supplier?.name ?? "—", in: 0, out: p.amount })),
      ...tailPays.map((p) => ({ date: p.paymentDate, type: "Tailor payment", description: p.tailor?.name ?? "—", in: 0, out: p.amount })),
      ...expenses.map((e) => ({ date: e.expenseDate, type: "Expense", description: `${e.category?.labelMy ?? "—"}${e.paidTo ? ` · ${e.paidTo}` : ""}`, in: 0, out: e.amount })),
      ...returns.map((r) => ({ date: r.returnDate, type: "Refund", description: `Sale #${r.saleId}`, in: 0, out: r.refundAmount })),
    ];
    raw.sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = openingCash;
    const transactions: StatementTxn[] = raw.map((r) => {
      balance += r.in - r.out;
      return { date: r.date.toISOString(), type: r.type, description: r.description, in: r.in, out: r.out, balance };
    });
    const totalIn = raw.reduce((s, r) => s + r.in, 0);
    const totalOut = raw.reduce((s, r) => s + r.out, 0);

    return {
      from: from
        ? toYangonYmd(from)
        : raw.length
          ? toYangonYmd(raw[0].date)
          : toYangonYmd(new Date(toStr)),
      to: toYangonYmd(new Date(toStr)),
      openingCash,
      closingCash: openingCash + totalIn - totalOut,
      totalIn,
      totalOut,
      salesTotal: sales.reduce((s, x) => s + x.grandTotal, 0),
      salesCount: sales.length,
      transactions,
    };
  }

  statementCsv(s: Statement): string {
    const headers = ["Date", "Type", "Description", "In (Ks)", "Out (Ks)", "Balance (Ks)"];
    const rows: (string | number)[][] = [
      ["", "Opening balance", `${s.from} → ${s.to}`, "", "", s.openingCash],
      ...s.transactions.map((t) => [t.date.slice(0, 10), t.type, t.description, t.in || "", t.out || "", t.balance]),
      ["", "Totals", "", s.totalIn, s.totalOut, ""],
      ["", "Closing balance", "", "", "", s.closingCash],
    ];
    return toCsv(headers, rows);
  }

  /** Full data dump of the active shop — every table (password hashes excluded).
   *  The disaster-recovery copy you keep off Railway. */
  async backup(): Promise<Record<string, unknown[]>> {
    const p = this.prisma;
    const [
      users, customers, suppliers, tailors, drivers, employees, itemTypes, expenseCategories,
      sales, saleLines, customerPayments, supplierOrders, supplierOrderReceipts, supplierPayments,
      tailorCharges, tailorPayments, inventoryEvents, inventoryLines, saleReturns, saleReturnLines,
      expenses, dailyCloses, stockExceptions, stockExceptionSales, shopSettings, auditLogs,
    ] = await Promise.all([
      p.user.findMany({ select: { id: true, username: true, displayName: true, photoUrl: true, roles: true, status: true, createdAt: true, updatedAt: true } }),
      p.customer.findMany(), p.supplier.findMany(), p.tailor.findMany(), p.driver.findMany(), p.employee.findMany(),
      p.itemType.findMany(), p.expenseCategory.findMany(),
      p.sale.findMany(), p.saleLine.findMany(), p.customerPayment.findMany(),
      p.supplierOrder.findMany(), p.supplierOrderReceipt.findMany(), p.supplierPayment.findMany(),
      p.tailorCharge.findMany(), p.tailorPayment.findMany(),
      p.inventoryEvent.findMany(), p.inventoryLine.findMany(),
      p.saleReturn.findMany(), p.saleReturnLine.findMany(),
      p.expense.findMany(), p.dailyClose.findMany(),
      p.stockException.findMany(), p.stockExceptionSale.findMany(),
      p.shopSetting.findMany(), p.auditLog.findMany(),
    ]);
    return {
      users, customers, suppliers, tailors, drivers, employees, itemTypes, expenseCategories,
      sales, saleLines, customerPayments, supplierOrders, supplierOrderReceipts, supplierPayments,
      tailorCharges, tailorPayments, inventoryEvents, inventoryLines, saleReturns, saleReturnLines,
      expenses, dailyCloses, stockExceptions, stockExceptionSales, shopSettings, auditLogs,
    };
  }
}
