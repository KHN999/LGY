import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto } from "./dto/create-expense.dto";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  list(range: { from?: string; to?: string } = {}) {
    return this.prisma.expense.findMany({
      where: {
        voidedAt: null,
        ...(range.from || range.to
          ? {
              expenseDate: {
                ...(range.from ? { gte: new Date(range.from) } : {}),
                ...(range.to ? { lte: new Date(range.to) } : {}),
              },
            }
          : {}),
      },
      orderBy: { expenseDate: "desc" },
      take: 500,
      include: {
        category: true,
        paidToEmployee: { select: { id: true, name: true } },
        paidToDriver: { select: { id: true, name: true } },
      },
    });
  }

  listCategories() {
    return this.prisma.expenseCategory.findMany({
      where: { isActive: true },
      orderBy: { id: "asc" },
    });
  }

  async create(dto: CreateExpenseDto, userId: number) {
    const cat = await this.prisma.expenseCategory.findUnique({ where: { id: dto.categoryId } });
    if (!cat) throw new BadRequestException(`Category ${dto.categoryId} not found`);
    return this.prisma.expense.create({
      data: {
        categoryId: dto.categoryId,
        amount: dto.amount,
        expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        paidTo: dto.paidTo,
        paidToEmployeeId: dto.paidToEmployeeId ?? null,
        paidToDriverId: dto.paidToDriverId ?? null,
        notes: dto.notes,
        createdById: userId,
      },
      include: { category: true },
    });
  }

  async void(id: number, reason: string | undefined, userId: number) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e) throw new NotFoundException(`Expense ${id} not found`);
    if (e.voidedAt) return e;
    return this.prisma.expense.update({
      where: { id },
      data: { voidedAt: new Date(), voidedById: userId, voidReason: reason },
    });
  }
}
