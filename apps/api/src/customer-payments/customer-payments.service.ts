import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCustomerPaymentDto } from "./dto/customer-payment.dto";

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
}
