import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerPaymentDto } from "./dto/customer-payment.dto";

function statusFor(grandTotal: number, paidAmount: number): "UNPAID" | "PARTIAL" | "PAID" {
  if (paidAmount <= 0) return "UNPAID";
  if (paidAmount >= grandTotal) return "PAID";
  return "PARTIAL";
}

@Injectable()
export class CustomerPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCustomerPaymentDto, createdById: number) {
    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new NotFoundException(`Customer ${dto.customerId} not found`);
    return this.prisma.customerPayment.create({
      data: {
        customerId: dto.customerId,
        amount: dto.amount,
        method: dto.method ?? "CASH",
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        notes: dto.notes,
        createdById,
      },
    });
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
