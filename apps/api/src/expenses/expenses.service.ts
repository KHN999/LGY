import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateExpenseDto, ExpenseMethodDto } from "./dto/create-expense.dto";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  list(opts: { from?: string; to?: string; employeeId?: number; driverId?: number } = {}) {
    return this.prisma.expense.findMany({
      where: {
        voidedAt: null,
        ...(opts.employeeId ? { paidToEmployeeId: opts.employeeId } : {}),
        ...(opts.driverId ? { paidToDriverId: opts.driverId } : {}),
        ...(opts.from || opts.to
          ? {
              expenseDate: {
                ...(opts.from ? { gte: new Date(opts.from) } : {}),
                ...(opts.to ? { lte: new Date(opts.to) } : {}),
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
    const name = dto.categoryName?.trim();
    let categoryId: number;
    if (name) {
      // A hand-typed name: reuse the category if it already exists (so the same
      // name typed twice stays one category), otherwise add it to the list.
      const existing = await this.prisma.expenseCategory.findFirst({
        where: { labelMy: { equals: name, mode: "insensitive" } },
      });
      if (existing) {
        if (!existing.isActive) {
          await this.prisma.expenseCategory.update({ where: { id: existing.id }, data: { isActive: true } });
        }
        categoryId = existing.id;
      } else {
        const created = await this.prisma.expenseCategory.create({
          data: { key: `custom_${Date.now().toString(36)}`, labelMy: name },
        });
        categoryId = created.id;
      }
    } else {
      if (!dto.categoryId) throw new BadRequestException("Choose a category or type a name");
      const cat = await this.prisma.expenseCategory.findUnique({ where: { id: dto.categoryId } });
      if (!cat) throw new BadRequestException(`Category ${dto.categoryId} not found`);
      categoryId = cat.id;
    }
    return this.prisma.expense.create({
      data: {
        categoryId,
        amount: dto.amount,
        method: dto.method ?? "CASH",
        bank: dto.method === "BANK_TRANSFER" ? (dto.bank ?? null) : null,
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

  /** Correct how an expense was paid (cash ↔ bank) without voiding it. */
  async setMethod(id: number, dto: ExpenseMethodDto) {
    const e = await this.prisma.expense.findUnique({ where: { id } });
    if (!e || e.voidedAt) throw new NotFoundException(`Expense ${id} not found`);
    return this.prisma.expense.update({
      where: { id },
      data: {
        method: dto.method,
        bank: dto.method === "BANK_TRANSFER" ? (dto.bank ?? null) : null,
      },
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
