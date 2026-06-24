import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CustomersService } from "../customers/customers.service";
import { assertDateNotClosed } from "../common/backdate";
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
    const payment = await this.prisma.customerPayment.create({
      data: {
        customerId: dto.customerId,
        amount: dto.amount,
        method: dto.method ?? "CASH",
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        notes: dto.notes,
        createdById,
      },
    });
    const balanceAfter = await this.customers.getBalance(dto.customerId);
    return {
      id: payment.id,
      customerId: payment.customerId,
      saleId: payment.saleId,
      amount: payment.amount,
      method: payment.method,
      paymentDate: payment.paymentDate,
      notes: payment.notes,
      customerName: customer.name,
      balanceAfter,
    };
  }

  /** Recent received payments (all customers) for the staff "money received"
   *  history. Optional Yangon-day range. Excludes voided. */
  async recent(opts: { limit?: number; from?: string; to?: string }) {
    const { limit = 50, from, to } = opts;
    const rows = await this.prisma.customerPayment.findMany({
      where: {
        voidedAt: null,
        ...(from && to ? { paymentDate: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      orderBy: { paymentDate: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        method: true,
        paymentDate: true,
        saleId: true,
        customerId: true,
        customer: { select: { name: true } },
      },
    });
    return rows.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      paymentDate: p.paymentDate,
      saleId: p.saleId,
      customerId: p.customerId,
      customerName: p.customer?.name ?? null,
    }));
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
