import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import { CustomersService } from "../customers/customers.service";
import { assertDateNotClosed } from "../common/backdate";
import { paymentParts } from "../common/payment-parts";
import { CreateCustomerPaymentDto } from "./dto/customer-payment.dto";

function statusFor(grandTotal: number, paidAmount: number): "UNPAID" | "PARTIAL" | "PAID" {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= grandTotal) return "PAID";
  return "PARTIAL";
}

/** Returned to the client so it can print a payment receipt with the customer's
 *  name and authoritative remaining balance, without another round-trip. */
export interface PaymentResult {
  id: number;
  customerId: number | null;
  saleId: number | null;
  amount: number;
  method: string;
  /** Bank-transfer portion of `amount` (0 for all-cash, = amount for all-bank). */
  bankAmount: number;
  /** Which bank the bank-transfer part came through, if recorded. */
  bank: string | null;
  paymentDate: Date;
  notes: string | null;
  customerName: string;
  balanceAfter: number;
}

@Injectable()
export class CustomerPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customers: CustomersService,
  ) {}

  async create(dto: CreateCustomerPaymentDto, createdById: number): Promise<PaymentResult> {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);
    await assertDateNotClosed(this.prisma, dto.paymentDate ? new Date(dto.paymentDate) : null);
    // One row per tender — two when the payment is split cash + bank. A batch
    // transaction keeps the pair atomic in a single round-trip.
    const parts = paymentParts(dto.amount, dto.method, dto.bankAmount, dto.bank);
    const paymentDate = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    const created = await this.prisma.$transaction(
      parts.map((part) =>
        this.prisma.customerPayment.create({
          data: {
            customerId: dto.customerId,
            amount: part.amount,
            method: part.method,
            bank: part.bank,
            paymentDate,
            notes: dto.notes,
            createdById,
          },
        }),
      ),
    );
    const payment = created[0];
    const bankAmount = parts
      .filter((part) => part.method === "BANK_TRANSFER")
      .reduce((s, part) => s + part.amount, 0);
    const balanceAfter = await this.customers.getBalance(dto.customerId);
    return {
      id: payment.id,
      customerId: payment.customerId,
      saleId: payment.saleId,
      amount: dto.amount,
      method: payment.method,
      bankAmount,
      bank: parts.find((part) => part.method === "BANK_TRANSFER")?.bank ?? null,
      paymentDate: payment.paymentDate,
      notes: payment.notes,
      customerName: customer.name,
      balanceAfter,
    };
  }

  /** Recent received payments (all customers) for the "money received" history.
   *  Optional Yangon-day range. `linked`: "account" = debt collection not tied to
   *  a sale (paying off previous sales), "sale" = paid at a sale. Excludes voided. */
  async recent(opts: { limit?: number; from?: string; to?: string; linked?: "sale" | "account" }) {
    const { limit = 50, from, to, linked } = opts;
    // Shared filter for the displayed page AND the totals, so the total reflects
    // the WHOLE range — not just the capped rows shown (that under-reported it).
    const where: Prisma.CustomerPaymentWhereInput = {
      voidedAt: null,
      ...(from && to ? { paymentDate: { gte: new Date(from), lte: new Date(to) } } : {}),
      ...(linked === "account" ? { saleId: null } : {}),
      ...(linked === "sale" ? { saleId: { not: null } } : {}),
    };
    const [rows, agg] = await Promise.all([
      this.prisma.customerPayment.findMany({
        where,
        orderBy: { paymentDate: "desc" },
        take: limit,
        select: {
          id: true,
          amount: true,
          method: true,
          bank: true,
          paymentDate: true,
          saleId: true,
          customerId: true,
          customer: { select: { name: true } },
        },
      }),
      this.prisma.customerPayment.aggregate({ where, _sum: { amount: true }, _count: true }),
    ]);
    return {
      rows: rows.map((p) => ({
        id: p.id,
        amount: p.amount,
        method: p.method,
        bank: p.bank,
        paymentDate: p.paymentDate,
        saleId: p.saleId,
        customerId: p.customerId,
        customerName: p.customer?.name ?? null,
      })),
      total: agg._sum.amount ?? 0,
      count: agg._count,
    };
  }

  async listForCustomer(customerId: number, limit = 50) {
    return this.prisma.customerPayment.findMany({
      where: { customerId, voidedAt: null },
      orderBy: { paymentDate: "desc" },
      take: limit,
      include: { sale: { select: { id: true, grandTotal: true } } },
    });
  }

  /**
   * Void a customer payment. If it was tied to a sale, decrement that sale's
   * cached paidAmount and recompute status (mirror of SalesService.addPayment),
   * unless the sale is itself voided (already reset to 0).
   */
  async void(id: number, reason: string, voidedById: number) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.customerPayment.findUnique({ where: { id } });
      if (!payment) throw new NotFoundException(`Payment ${id} not found`);
      if (payment.voidedAt) throw new ConflictException("Payment is already voided");

      await tx.customerPayment.update({
        where: { id },
        data: { voidedAt: new Date(), voidedById, voidReason: reason },
      });

      if (payment.saleId) {
        const sale = await tx.sale.findUnique({ where: { id: payment.saleId } });
        if (sale && !sale.voidedAt) {
          const newPaid = Math.max(0, sale.paidAmount - payment.amount);
          await tx.sale.update({
            where: { id: sale.id },
            data: { paidAmount: newPaid, status: statusFor(sale.grandTotal, newPaid) },
          });
        }
      }

      return tx.customerPayment.findUnique({ where: { id } });
    });
  }
}
