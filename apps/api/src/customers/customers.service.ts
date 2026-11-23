import { blankToNull } from "../common/blank";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@lgy/db";
import { PrismaService } from "../prisma/prisma.service";
import type { PageResult } from "../common/pagination.dto";
import { CreateCustomerDto, UpdateCustomerDto } from "./dto/customer.dto";
import { ImportCustomersDto } from "./dto/import-customers.dto";
import { gramWeights, normalizeName, nameKey, nameSimilarity, prepareName, searchScore } from "../common/name";
import { addDays, ymdToYangonStart } from "../common/yangon-time";

export interface CustomerWithBalance {
  id: number;
  name: string;
  contact: string | null;
  photoUrl: string | null;
  defaultKind: "WHOLESALE" | "RETAIL";
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  /** Outstanding debt: positive = customer owes us. */
  balance: number;
}

type CustomerBalanceRow = {
  customerId: number;
  balance: number;
};

type CustomerListSqlRow = Omit<CustomerWithBalance, "balance"> & {
  balance: number;
  total: number;
};

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(opts: {
    page: number;
    limit: number;
    search?: string;
    activeOnly?: boolean;
    inactiveOnly?: boolean;
  }): Promise<PageResult<CustomerWithBalance>> {
    const { page, limit, search, activeOnly = true, inactiveOnly = false } = opts;
    // Deleted customers are written off — never shown in any list.
    const filters: Prisma.Sql[] = [Prisma.sql`c."deletedAt" IS NULL`];
    if (inactiveOnly) filters.push(Prisma.sql`c.status = 'INACTIVE'::"PartyStatus"`);
    else if (activeOnly) filters.push(Prisma.sql`c.status = 'ACTIVE'::"PartyStatus"`);
    // With a search, results come back best match first instead of A→Z.
    let rankedIds: number[] | null = null;
    if (search && search.trim()) {
      // Loose matching done here rather than in SQL: the typed text may sit
      // anywhere in the name (a town or title written in front must not hide
      // the person) and a slip of a character or two still matches — the fix
      // for staff not finding an existing customer and creating a duplicate.
      // Digits also match the phone number.
      const q = prepareName(search);
      const digits = search.replace(/\D/g, "");
      const all = await this.prisma.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, contact: true },
      });
      rankedIds = all
        .map((c) => {
          let score = searchScore(q, prepareName(c.name));
          if (digits.length >= 3 && (c.contact ?? "").replace(/\D/g, "").includes(digits)) {
            score = Math.max(score, 0.97);
          }
          return { id: c.id, name: c.name, score };
        })
        .filter((c) => c.score >= 0.65)
        .sort((x, y) => y.score - x.score || x.name.localeCompare(y.name))
        .map((c) => c.id);
      if (rankedIds.length === 0) return { data: [], page, limit, total: 0 };
      filters.push(Prisma.sql`c.id = ANY(${rankedIds}::int[])`);
    }
    const orderSql = rankedIds
      ? Prisma.sql`ORDER BY array_position(${rankedIds}::int[], id) ASC`
      : Prisma.sql`ORDER BY name ASC`;
    const whereSql = filters.length
      ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<CustomerListSqlRow[]>(Prisma.sql`
      WITH filtered AS (
        SELECT c.*
        FROM "Customer" c
        ${whereSql}
      ),
      page_rows AS (
        SELECT
          filtered.*,
          COUNT(*) OVER()::int AS total
        FROM filtered
        ${orderSql}
        OFFSET ${(page - 1) * limit}
        LIMIT ${limit}
      ),
      sales AS (
        SELECT "customerId", SUM("grandTotal")::int AS total
        FROM "Sale"
        WHERE "customerId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      payments AS (
        SELECT "customerId", SUM(amount)::int AS total
        FROM "CustomerPayment"
        WHERE "customerId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      returns AS (
        SELECT
          "customerId",
          SUM("returnTotal")::int AS return_total,
          SUM("refundAmount")::int AS refund_total
        FROM "SaleReturn"
        WHERE "customerId" IN (SELECT id FROM page_rows)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      )
      SELECT
        p.id,
        p.name,
        p.contact,
        p."photoUrl",
        p."defaultKind",
        p.notes,
        p.status,
        (
          COALESCE(sales.total, 0)
          - COALESCE(returns.return_total, 0)
          - COALESCE(payments.total, 0)
          + COALESCE(returns.refund_total, 0)
        )::int AS balance,
        p.total
      FROM page_rows p
      LEFT JOIN sales ON sales."customerId" = p.id
      LEFT JOIN payments ON payments."customerId" = p.id
      LEFT JOIN returns ON returns."customerId" = p.id
    `);
    // The outer query does not keep the page order — restore it here.
    if (rankedIds) {
      const pos = new Map(rankedIds.map((id, i) => [id, i]));
      rows.sort((x, y) => (pos.get(Number(x.id)) ?? 0) - (pos.get(Number(y.id)) ?? 0));
    } else {
      rows.sort((x, y) => x.name.localeCompare(y.name));
    }

    return {
      data: rows.map(({ total, ...r }) => r),
      page,
      limit,
      total: rows[0]?.total ?? 0,
    };
  }

  async getOne(id: number): Promise<CustomerWithBalance> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    return { ...customer, balance: await this.getBalance(id) };
  }

  /**
   * Find an existing customer by phone (digits) — or by name when there's no
   * phone — else create one. For the staff sell flow's "import from phone",
   * which must work for non-admins (POST /customers is admin-only). Dedupes so
   * repeatedly importing the same contact doesn't pile up duplicates.
   */
  async findOrCreateFromContact(name: string, contact?: string): Promise<CustomerWithBalance> {
    const cleanName = normalizeName(name);
    if (!cleanName) throw new BadRequestException("Contact name is required");
    const cleanContact = contact?.trim() || null;
    const digits = (s: string | null) => (s ?? "").replace(/\D/g, "");
    const phone = digits(cleanContact);

    const all = await this.prisma.customer.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, contact: true },
    });
    const match = phone
      ? all.find((c) => digits(c.contact) === phone)
      : all.find((c) => nameKey(c.name) === nameKey(cleanName));

    if (match) {
      const existing = await this.prisma.customer.findUnique({ where: { id: match.id } });
      return { ...existing!, balance: await this.getBalance(match.id) };
    }

    const created = await this.prisma.customer.create({
      data: { name: cleanName, contact: cleanContact, defaultKind: "WHOLESALE", status: "ACTIVE" },
    });
    return { ...created, balance: 0 };
  }

  async create(dto: CreateCustomerDto): Promise<CustomerWithBalance> {
    const customer = await this.prisma.customer.create({
      data: {
        name: normalizeName(dto.name),
        contact: dto.contact,
        photoUrl: dto.photoUrl,
        defaultKind: dto.defaultKind ?? "WHOLESALE",
        notes: dto.notes,
        status: dto.status ?? "ACTIVE",
      },
    });
    return { ...customer, balance: 0 };
  }

  /** Bulk-create customers from picked phone contacts. Skips anyone whose phone
   *  already exists (or whose name already exists when they have no phone), and
   *  de-dupes within the batch too. One createMany round-trip. */
  async importContacts(dto: ImportCustomersDto): Promise<{ created: number; skipped: number }> {
    const digits = (s: string | null | undefined) => (s ?? "").replace(/\D/g, "");

    const existing = await this.prisma.customer.findMany({ select: { name: true, contact: true } });
    const seenPhones = new Set(existing.map((c) => digits(c.contact)).filter(Boolean));
    const seenNames = new Set(existing.map((c) => nameKey(c.name)));

    const toCreate: { name: string; contact: string | null }[] = [];
    let skipped = 0;
    for (const c of dto.contacts) {
      const name = normalizeName(c.name);
      const phone = digits(c.contact);
      if (!name) {
        skipped++;
        continue;
      }
      const key = nameKey(name);
      const dup = phone ? seenPhones.has(phone) : seenNames.has(key);
      if (dup) {
        skipped++;
        continue;
      }
      if (phone) seenPhones.add(phone);
      else seenNames.add(key);
      toCreate.push({ name, contact: c.contact?.trim() || null });
    }

    if (toCreate.length > 0) {
      await this.prisma.customer.createMany({ data: toCreate });
    }
    return { created: toCreate.length, skipped };
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<CustomerWithBalance> {
    const existing = await this.prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Customer ${id} not found`);
    const customer = await this.prisma.customer.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: normalizeName(dto.name) } : {}),
        ...(dto.contact !== undefined ? { contact: blankToNull(dto.contact) } : {}),
        ...(dto.photoUrl !== undefined ? { photoUrl: dto.photoUrl } : {}),
        ...(dto.defaultKind !== undefined ? { defaultKind: dto.defaultKind } : {}),
        ...(dto.notes !== undefined ? { notes: blankToNull(dto.notes) } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
    });
    return { ...customer, balance: await this.getBalance(id) };
  }

  /**
   * Soft-delete a customer and write off any outstanding debt: sets deletedAt so
   * they drop out of every list/picker and the debt totals, while their past
   * sales/payments stay intact. Returns the name + the balance that was cleared
   * (for the audit log). Idempotent — re-deleting clears nothing more.
   */
  async softDelete(id: number): Promise<{ id: number; name: string; clearedDebt: number }> {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);
    if (customer.deletedAt) return { id: customer.id, name: customer.name, clearedDebt: 0 };
    const clearedDebt = Math.max(0, await this.getBalance(id));
    await this.prisma.customer.update({ where: { id }, data: { deletedAt: new Date() } });
    return { id: customer.id, name: customer.name, clearedDebt };
  }

  /** Last sale date and number of sales per customer (non-voided). */
  private async salesStats(ids: number[]): Promise<Map<number, { count: number; last: Date | null }>> {
    const map = new Map<number, { count: number; last: Date | null }>();
    if (ids.length === 0) return map;
    const rows = await this.prisma.sale.groupBy({
      by: ["customerId"],
      where: { customerId: { in: ids }, voidedAt: null },
      _count: { _all: true },
      _max: { saleDate: true },
    });
    for (const r of rows) {
      if (r.customerId != null) map.set(r.customerId, { count: r._count._all, last: r._max.saleDate });
    }
    return map;
  }

  /**
   * Existing customers that may be the same person as `name` — for the "did you
   * mean…?" check when adding a customer and for merge suggestions. Loose match
   * (see common/name): titles/towns in front, dropped tone marks and small
   * typos still match. Best match first; empty for very short input.
   */
  async similar(
    name: string,
    excludeId?: number,
  ): Promise<(CustomerWithBalance & { score: number; lastSaleAt: Date | null; salesCount: number })[]> {
    const q = prepareName(name);
    if (q.chars.length < 2) return [];
    const all = await this.prisma.customer.findMany({ where: { deletedAt: null } });
    const prepared = all.map((c) => prepareName(c.name));
    const weights = gramWeights(prepared);
    const hits = all
      .map((c, i) => {
        const n = prepared[i]!;
        // Either reading counts: the typed text found inside an existing name,
        // or the two names being alike overall.
        return { c, score: Math.max(searchScore(q, n), nameSimilarity(q, n, weights)) };
      })
      .filter((h) => h.c.id !== excludeId)
      .filter((h) => h.score >= 0.62)
      .sort((x, y) => y.score - x.score || x.c.name.localeCompare(y.c.name))
      .slice(0, 8);
    const ids = hits.map((h) => h.c.id);
    const [balances, stats] = await Promise.all([this.balancesFor(ids), this.salesStats(ids)]);
    return hits.map(({ c, score }) => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      photoUrl: c.photoUrl,
      defaultKind: c.defaultKind,
      notes: c.notes,
      status: c.status,
      balance: balances.get(c.id) ?? 0,
      score: Math.round(score * 100) / 100,
      lastSaleAt: stats.get(c.id)?.last ?? null,
      salesCount: stats.get(c.id)?.count ?? 0,
    }));
  }

  /**
   * Groups of customers that look like the same person entered more than once,
   * for the admin clean-up page. Pairs an admin already marked "not the same"
   * are left out. Each group suggests keeping the record with the most sales.
   */
  async duplicates(): Promise<{
    groups: {
      suggestedKeepId: number;
      members: {
        id: number;
        name: string;
        contact: string | null;
        balance: number;
        salesCount: number;
        lastSaleAt: Date | null;
        createdAt: Date;
      }[];
    }[];
  }> {
    const [all, dismissed] = await Promise.all([
      this.prisma.customer.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, contact: true, createdAt: true },
        orderBy: { id: "asc" },
      }),
      this.prisma.customerPairDismissal.findMany({ select: { aId: true, bId: true } }),
    ]);
    const skip = new Set(dismissed.map((d) => `${d.aId}:${d.bId}`));
    const prepared = all.map((c) => prepareName(c.name));
    const digits = all.map((c) => (c.contact ?? "").replace(/\D/g, ""));
    const weights = gramWeights(prepared);

    // Union-find over pairs that look alike (or share a phone number).
    const parent = all.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        if (skip.has(`${all[i]!.id}:${all[j]!.id}`)) continue;
        const samePhone = digits[i]!.length >= 7 && digits[i] === digits[j];
        if (samePhone || nameSimilarity(prepared[i]!, prepared[j]!, weights) >= 0.8) parent[find(i)] = find(j);
      }
    }
    const byRoot = new Map<number, number[]>();
    all.forEach((_, i) => {
      const root = find(i);
      byRoot.set(root, [...(byRoot.get(root) ?? []), i]);
    });
    const clusters = [...byRoot.values()].filter((g) => g.length > 1);
    const ids = clusters.flat().map((i) => all[i]!.id);
    const [balances, stats] = await Promise.all([this.balancesFor(ids), this.salesStats(ids)]);

    const groups = clusters.map((g) => {
      const members = g.map((i) => {
        const c = all[i]!;
        return {
          id: c.id,
          name: c.name,
          contact: c.contact,
          balance: balances.get(c.id) ?? 0,
          salesCount: stats.get(c.id)?.count ?? 0,
          lastSaleAt: stats.get(c.id)?.last ?? null,
          createdAt: c.createdAt,
        };
      });
      // Keep the record that has been used the most; oldest wins a tie.
      const keep = [...members].sort((x, y) => y.salesCount - x.salesCount || x.id - y.id)[0]!;
      return { suggestedKeepId: keep.id, members };
    });
    groups.sort((x, y) => y.members.length - x.members.length || x.members[0]!.name.localeCompare(y.members[0]!.name));
    return { groups };
  }

  /** Remember that these customers are different people, so they are not
   *  suggested as duplicates of each other again. */
  async dismissDuplicates(idsRaw: number[]): Promise<{ dismissed: number }> {
    const ids = [...new Set(idsRaw)].sort((a, b) => a - b);
    if (ids.length < 2) throw new BadRequestException("Pick at least two customers");
    const pairs: { aId: number; bId: number }[] = [];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) pairs.push({ aId: ids[i]!, bId: ids[j]! });
    }
    await this.prisma.customerPairDismissal.createMany({ data: pairs, skipDuplicates: true });
    return { dismissed: pairs.length };
  }

  async merge(
    survivorId: number,
    sourceIdsRaw: number[],
  ): Promise<CustomerWithBalance & { mergedCount: number; mergedNames: string[] }> {
    const survivor = await this.prisma.customer.findUnique({ where: { id: survivorId } });
    if (!survivor) throw new NotFoundException(`Customer ${survivorId} not found`);
    if (survivor.deletedAt) throw new BadRequestException("Cannot merge into a deleted customer");

    const ids = [...new Set(sourceIdsRaw)].filter((id) => id !== survivorId);
    if (ids.length === 0) {
      throw new BadRequestException("Pick at least one other customer to merge in");
    }
    const sources = await this.prisma.customer.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true, name: true, contact: true, notes: true },
    });
    if (sources.length === 0) throw new BadRequestException("No valid customers to merge");
    const sourceIds = sources.map((s) => s.id);

    await this.prisma.$transaction(async (tx) => {
      const where = { customerId: { in: sourceIds } };
      await tx.sale.updateMany({ where, data: { customerId: survivorId } });
      await tx.customerPayment.updateMany({ where, data: { customerId: survivorId } });
      await tx.saleReturn.updateMany({ where, data: { customerId: survivorId } });

      // Backfill a missing contact/notes on the survivor from a duplicate.
      const fill: { contact?: string; notes?: string } = {};
      if (!survivor.contact) {
        const c = sources.find((s) => s.contact?.trim())?.contact;
        if (c) fill.contact = c;
      }
      if (!survivor.notes) {
        const n = sources.find((s) => s.notes?.trim())?.notes;
        if (n) fill.notes = n;
      }
      if (Object.keys(fill).length > 0) {
        await tx.customer.update({ where: { id: survivorId }, data: fill });
      }

      await tx.customer.updateMany({
        where: { id: { in: sourceIds } },
        data: { deletedAt: new Date(), status: "INACTIVE" },
      });
    });

    const updated = await this.getOne(survivorId);
    return { ...updated, mergedCount: sources.length, mergedNames: sources.map((s) => s.name) };
  }

  async getBalance(
    customerId: number,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    return (await this.balancesFor([customerId], tx)).get(customerId) ?? 0;
  }

  async balancesFor(
    customerIds: number[],
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Map<number, number>> {
    if (customerIds.length === 0) return new Map();
    const map = new Map<number, number>();
    for (const id of customerIds) map.set(id, 0);

    const idValues = Prisma.join(customerIds.map((id) => Prisma.sql`(${id})`));
    const rows = await tx.$queryRaw<CustomerBalanceRow[]>(Prisma.sql`
      WITH selected(id) AS (VALUES ${idValues}),
      sales AS (
        SELECT "customerId", SUM("grandTotal")::int AS total
        FROM "Sale"
        WHERE "customerId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      payments AS (
        SELECT "customerId", SUM(amount)::int AS total
        FROM "CustomerPayment"
        WHERE "customerId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      ),
      returns AS (
        SELECT
          "customerId",
          SUM("returnTotal")::int AS return_total,
          SUM("refundAmount")::int AS refund_total
        FROM "SaleReturn"
        WHERE "customerId" IN (SELECT id FROM selected)
          AND "voidedAt" IS NULL
        GROUP BY "customerId"
      )
      SELECT
        selected.id AS "customerId",
        (
          COALESCE(sales.total, 0)
          - COALESCE(returns.return_total, 0)
          - COALESCE(payments.total, 0)
          + COALESCE(returns.refund_total, 0)
        )::int AS balance
      FROM selected
      LEFT JOIN sales ON sales."customerId" = selected.id
      LEFT JOIN payments ON payments."customerId" = selected.id
      LEFT JOIN returns ON returns."customerId" = selected.id
    `);
    for (const r of rows) {
      // $queryRaw returns the VALUES id as a BigInt; the map is looked up with a
      // Number in getBalance, so coerce or the lookup misses and returns 0.
      map.set(Number(r.customerId), Number(r.balance));
    }
    return map;
  }

  /**
   * Account statement. Reads ALL of the customer's non-voided sales, payments and
   * returns (no row cap — a truncated list would give a wrong balance), then
   * splits them at the period start: everything earlier becomes the opening
   * balance, everything inside is listed with a running balance. Uses the same
   * balance rule as everywhere else: sale +total, payment −amount, return
   * −goods value +cash refunded.
   */
  async statement(id: number, from?: string, to?: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new NotFoundException(`Customer ${id} not found`);

    const [sales, payments, returns] = await Promise.all([
      this.prisma.sale.findMany({
        where: { customerId: id, voidedAt: null },
        select: {
          id: true,
          saleDate: true,
          grandTotal: true,
          lines: {
            select: { qty: true, unitPrice: true, itemName: true, itemType: { select: { labelMy: true } } },
          },
        },
      }),
      this.prisma.customerPayment.findMany({
        where: { customerId: id, voidedAt: null },
        select: { id: true, paymentDate: true, amount: true, method: true, bank: true, saleId: true },
      }),
      this.prisma.saleReturn.findMany({
        where: { customerId: id, voidedAt: null },
        select: { id: true, returnDate: true, returnTotal: true, refundAmount: true, saleId: true },
      }),
    ]);

    type Row = {
      date: Date;
      kind: "SALE" | "PAYMENT" | "RETURN";
      refId: number;
      saleId: number | null;
      /** Adds to what the customer owes. */
      debit: number;
      /** Reduces what the customer owes. */
      credit: number;
      method: string | null;
      bank: string | null;
      items: { label: string; qty: number; unitPrice: number }[];
    };
    const all: Row[] = [
      ...sales.map((s): Row => ({
        date: s.saleDate, kind: "SALE", refId: s.id, saleId: s.id, debit: s.grandTotal, credit: 0,
        method: null, bank: null,
        items: s.lines.map((l) => ({ label: l.itemType?.labelMy ?? l.itemName ?? "", qty: l.qty, unitPrice: l.unitPrice })),
      })),
      ...payments.map((p): Row => ({
        date: p.paymentDate, kind: "PAYMENT", refId: p.id, saleId: p.saleId, debit: 0, credit: p.amount,
        method: p.method, bank: p.bank, items: [],
      })),
      ...returns.map((r): Row => ({
        date: r.returnDate, kind: "RETURN", refId: r.id, saleId: r.saleId, debit: r.refundAmount, credit: r.returnTotal,
        method: null, bank: null, items: [],
      })),
    ];
    // Oldest first; on the same instant a sale comes before the payment for it.
    const order = { SALE: 0, RETURN: 1, PAYMENT: 2 } as const;
    all.sort((a, b) => a.date.getTime() - b.date.getTime() || order[a.kind] - order[b.kind] || a.refId - b.refId);

    const start = from ? ymdToYangonStart(from) : null;
    const end = to ? addDays(ymdToYangonStart(to), 1) : null; // exclusive
    let balance = 0;
    let opening = 0;
    const rows: (Row & { balance: number })[] = [];
    for (const r of all) {
      if (end && r.date >= end) continue; // after the period: not part of this statement
      balance += r.debit - r.credit;
      if (start && r.date < start) opening = balance;
      else rows.push({ ...r, balance });
    }
    const inPeriod = (k: Row["kind"]) => rows.filter((r) => r.kind === k);
    return {
      customer: { id: customer.id, name: customer.name, contact: customer.contact, deleted: customer.deletedAt != null },
      from: from ?? null,
      to: to ?? null,
      firstDate: all[0]?.date ?? null,
      opening,
      closing: balance,
      totals: {
        sales: inPeriod("SALE").reduce((s, r) => s + r.debit, 0),
        salesCount: inPeriod("SALE").length,
        payments: inPeriod("PAYMENT").reduce((s, r) => s + r.credit, 0),
        paymentsCount: inPeriod("PAYMENT").length,
        returned: inPeriod("RETURN").reduce((s, r) => s + r.credit, 0),
        refunded: inPeriod("RETURN").reduce((s, r) => s + r.debit, 0),
      },
      rows,
    };
  }
}
