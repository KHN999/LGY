import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateSupplierPaymentDto } from "./dto/supplier-payment.dto";

@Injectable()
export class SupplierPaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSupplierPaymentDto, createdById: number) {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException(`Supplier ${dto.supplierId} not found`);

    if (dto.orderId !== undefined) {
      const order = await this.prisma.supplierOrder.findUnique({ where: { id: dto.orderId } });
      if (!order) throw new BadRequestException(`SupplierOrder ${dto.orderId} not found`);
      if (order.supplierId !== dto.supplierId) {
        throw new BadRequestException(`Order ${dto.orderId} does not belong to supplier ${dto.supplierId}`);
      }
    }

    return this.prisma.supplierPayment.create({
      data: {
        supplierId: dto.supplierId,
        orderId: dto.orderId,
        amount: dto.amount,
        method: dto.method ?? "CASH",
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        notes: dto.notes,
        createdById,
      },
    });
  }

  async listForSupplier(supplierId: number, limit = 50) {
    return this.prisma.supplierPayment.findMany({
      where: { supplierId, voidedAt: null },
      orderBy: { paymentDate: "desc" },
      take: limit,
      include: { order: { select: { id: true, expectedQty: true, expectedTotal: true } } },
    });
  }
}
