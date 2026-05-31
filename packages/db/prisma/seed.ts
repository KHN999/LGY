import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── Draft-data gate ────────────────────────────────────────────────
// Heavy demo data (parties + a month of transactions) is seeded ONLY into the
// playground sandbox schema, or when SEED_DEMO=1 is set explicitly. The real
// `public` (main) schema gets just the baseline so production stays clean.
function activeSchema(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").searchParams.get("schema") ?? "public";
  } catch {
    return "public";
  }
}
const WANT_DEMO = process.env.SEED_DEMO === "1" || activeSchema() === "playground";

// ─── Reproducible pseudo-randomness (so the draft set is stable) ─────
function makeRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = makeRng(20260531);
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;

const DAY_MS = 86_400_000;
const NOW = new Date();
/** A datetime `n` days ago at the given local hour. */
function daysAgo(n: number, hour = 11): Date {
  const d = new Date(NOW.getTime() - n * DAY_MS);
  d.setHours(hour, randInt(0, 59), 0, 0);
  return d;
}
function midnight(n: number): Date {
  const d = new Date(NOW.getTime() - n * DAY_MS);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Per-item economics (kyat). ROLL is raw material (not sold).
const ECON: Record<string, { cost: number; sell: number }> = {
  ROLL: { cost: 250_000, sell: 0 },
  MIKLYO: { cost: 8_000, sell: 12_000 },
  WAMSAIK: { cost: 9_000, sell: 14_000 },
  MA_CHOOK_YA_THE: { cost: 6_000, sell: 10_000 },
  CHOK_KWIN: { cost: 7_000, sell: 11_000 },
  CHIBAUNG_THAR: { cost: 7_500, sell: 12_500 },
};

async function main() {
  // ═══ Baseline (always, both schemas) ══════════════════════════════
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "kaung";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const adminDisplayName = process.env.SEED_ADMIN_DISPLAY_NAME ?? "Kaung";

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      displayName: adminDisplayName,
      roles: ["admin", "staff"],
      status: UserStatus.ACTIVE,
    },
  });

  const itemTypes = [
    { key: "ROLL", labelMy: "အလိပ်", emoji: "🧻", sortOrder: 0, sellable: false },
    { key: "MIKLYO", labelMy: "မိုက်လျော့", emoji: "🧵", sortOrder: 10, sellable: true },
    { key: "WAMSAIK", labelMy: "ဝမ်းဆက်", emoji: "👕", sortOrder: 20, sellable: true },
    { key: "MA_CHOOK_YA_THE", labelMy: "မူဆယ်ပါတိတ်", emoji: "✂️", sortOrder: 30, sellable: true },
    { key: "CHOK_KWIN", labelMy: "မူဆယ်ပါတိတ် (ချုပ်ကွင်း)", emoji: "🪡", sortOrder: 40, sellable: true },
    { key: "CHIBAUNG_THAR", labelMy: "ချည်ပေါင်းသား", emoji: "🧺", sortOrder: 50, sellable: true },
  ];
  for (const t of itemTypes) {
    await prisma.itemType.upsert({
      where: { key: t.key },
      update: { labelMy: t.labelMy, emoji: t.emoji, sortOrder: t.sortOrder, isActive: true, sellable: t.sellable },
      create: t,
    });
  }

  const categories = [
    { key: "salary", labelMy: "လစာ" },
    { key: "driver_fee", labelMy: "ကားခ" },
    { key: "transport", labelMy: "သယ်ယူပို့ဆောင်ခ" },
    { key: "loading", labelMy: "ဝန်ထမ်းခ (ကုန်တင်/ကုန်ချ)" },
    { key: "shop_rent", labelMy: "ဆိုင်ငှား" },
    { key: "utilities", labelMy: "မီတာခ / ရေခ" },
    { key: "wash_softener", labelMy: "ချည်ပေါင်းသား ကုန်ကျစရိတ်" },
    { key: "tailor_fee", labelMy: "ချုပ်ခ" },
    { key: "misc", labelMy: "ထွေထွေထူးထူး" },
  ];
  for (const c of categories) {
    await prisma.expenseCategory.upsert({
      where: { key: c.key },
      update: { labelMy: c.labelMy, isActive: true },
      create: c,
    });
  }

  console.log(`✔ Admin user: ${admin.username} (id=${admin.id})`);
  console.log(`✔ Item types: ${itemTypes.length}  ·  Expense categories: ${categories.length}`);

  // ═══ Draft demo data (playground only) ════════════════════════════
  if (!WANT_DEMO) {
    console.log("• Baseline only (set SEED_DEMO=1 or use the playground schema for draft data).");
    return;
  }
  if ((await prisma.sale.count()) > 0) {
    console.log("• Demo data already present — skipping (idempotent).");
    return;
  }
  console.log("▶ Seeding ~1 month of draft data…");
  await seedDemo(admin.id);
}

async function seedDemo(adminId: number) {
  // A second (staff-only) user so events have varied authors.
  const staff = await prisma.user.upsert({
    where: { username: "mya" },
    update: {},
    create: {
      username: "mya",
      passwordHash: await bcrypt.hash("changeme123", 12),
      displayName: "Ma Mya",
      roles: ["staff"],
      status: UserStatus.ACTIVE,
    },
  });
  const authors = [adminId, staff.id];
  const author = () => pick(authors);

  // Per-day cash buckets (by "days ago" offset) used to compute daily closes.
  const byDay: Record<number, { received: number; paidOut: number }> = {};
  const got = (o: number) => (byDay[o] ??= { received: 0, paidOut: 0 });
  const addReceived = (o: number, amt: number) => (got(o).received += amt);
  const addPaidOut = (o: number, amt: number) => (got(o).paidOut += amt);

  // ── Parties ──────────────────────────────────────────────────────
  const customers = await Promise.all(
    [
      { name: "ဦးအောင်ကျော် (လက်ကား)", defaultKind: "WHOLESALE" as const, creditLimit: 2_000_000 },
      { name: "ဒေါ်မြ (လက်လီ)", defaultKind: "RETAIL" as const },
      { name: "ကိုဇော် ဆိုင်", defaultKind: "WHOLESALE" as const, creditLimit: 1_000_000 },
      { name: "ဒေါ်နီလာ", defaultKind: "RETAIL" as const },
      { name: "ဦးထွန်းမြင့်", defaultKind: "WHOLESALE" as const },
      { name: " မလှလှ ဈေးသည်", defaultKind: "RETAIL" as const },
    ].map((c, i) =>
      prisma.customer.create({
        data: { ...c, contact: `09-4${randInt(10, 99)}-${randInt(100000, 999999)}`, createdAt: daysAgo(35 - i) },
      }),
    ),
  );

  const suppliers = await Promise.all(
    ["ရွှေပြည် အထည်ဆိုင်", "မန္တလေး ပါတိတ်ကုမ္ပဏီ", "ရန်ကုန် Textile"].map((name, i) =>
      prisma.supplier.create({ data: { name, contact: `09-7${randInt(10, 99)}-${randInt(100000, 999999)}`, createdAt: daysAgo(40 - i) } }),
    ),
  );

  const tailors = await Promise.all(
    [
      { name: "ဦးစိန်ဝင်း (ချုပ်ဆရာ)", defaultFeePerPiece: 1_500 },
      { name: "ဒေါ်ခင်လှ", defaultFeePerPiece: 1_200 },
      { name: "ကိုမျိုး ချုပ်ခန်း", defaultFeePerPiece: 1_800 },
    ].map((t) => prisma.tailor.create({ data: { ...t, contact: `09-2${randInt(10, 99)}-${randInt(100000, 999999)}` } })),
  );

  const drivers = await Promise.all(
    [
      { name: "ကိုလှ (ကား)", defaultFee: 30_000 },
      { name: "ဦးတင် (လိုက်ထရပ်)", defaultFee: 25_000 },
    ].map((d) => prisma.driver.create({ data: { ...d, contact: `09-5${randInt(10, 99)}-${randInt(100000, 999999)}` } })),
  );

  const employees = await Promise.all(
    [
      { name: "မသီတာ", monthlySalary: 250_000 },
      { name: "ကိုရဲ", monthlySalary: 280_000 },
    ].map((e) => prisma.employee.create({ data: { ...e, contact: `09-9${randInt(10, 99)}-${randInt(100000, 999999)}` } })),
  );

  // ── Item types + economics ───────────────────────────────────────
  const types = await prisma.itemType.findMany();
  const byKey = Object.fromEntries(types.map((t) => [t.key, t]));
  const sellable = types.filter((t) => t.sellable);
  const roll = byKey["ROLL"];

  // ── Opening stock @ WAREHOUSE, then transfer some to the SHOP ──────
  await prisma.inventoryEvent.create({
    data: {
      kind: "OPENING_STOCK",
      occurredAt: daysAgo(30, 8),
      notes: "ဖွင့်လှစ်စဉ် လက်ကျန် (draft)",
      createdById: adminId,
      lines: {
        create: [
          { direction: "IN", location: "WAREHOUSE", itemTypeId: roll.id, qty: 25, unitCost: ECON.ROLL.cost },
          ...sellable.map((t) => ({
            direction: "IN" as const,
            location: "WAREHOUSE" as const,
            itemTypeId: t.id,
            qty: 600,
            unitCost: ECON[t.key]?.cost ?? null,
          })),
        ],
      },
    },
  });
  // Stock the shop shelf (warehouse → shop).
  await prisma.inventoryEvent.create({
    data: {
      kind: "TRANSFER",
      occurredAt: daysAgo(30, 9),
      notes: "ဆိုင်သို့ ပို့ (draft)",
      createdById: adminId,
      lines: {
        create: sellable.flatMap((t) => [
          { direction: "OUT" as const, location: "WAREHOUSE" as const, itemTypeId: t.id, qty: 300 },
          { direction: "IN" as const, location: "SHOP" as const, itemTypeId: t.id, qty: 300 },
        ]),
      },
    },
  });
  // Mid-month restock.
  await prisma.inventoryEvent.create({
    data: {
      kind: "TRANSFER",
      occurredAt: daysAgo(14, 9),
      notes: "ဆိုင် ပြန်ဖြည့် (draft)",
      createdById: author(),
      lines: {
        create: sellable.flatMap((t) => [
          { direction: "OUT" as const, location: "WAREHOUSE" as const, itemTypeId: t.id, qty: 150 },
          { direction: "IN" as const, location: "SHOP" as const, itemTypeId: t.id, qty: 150 },
        ]),
      },
    },
  });

  // ── Supplier orders → receipts (RECEIPT events) → payments ─────────
  const evRcptA = await prisma.inventoryEvent.create({
    data: {
      kind: "RECEIPT",
      occurredAt: daysAgo(26),
      notes: "ကုန်ဝင် (draft)",
      createdById: adminId,
      lines: { create: [{ direction: "IN", location: "WAREHOUSE", itemTypeId: roll.id, qty: 10, unitCost: 250_000 }] },
    },
  });
  const orderA = await prisma.supplierOrder.create({
    data: {
      supplierId: suppliers[0].id,
      itemTypeId: roll.id,
      orderDate: daysAgo(28),
      status: "RECEIVED",
      expectedQty: 10,
      expectedTotal: 2_500_000,
      createdById: adminId,
      receipts: {
        create: {
          receivedQty: 10,
          goodsCost: 2_500_000,
          transportCost: 50_000,
          receivedAt: daysAgo(26),
          createdById: adminId,
          eventId: evRcptA.id,
        },
      },
    },
  });
  const evRcptB = await prisma.inventoryEvent.create({
    data: {
      kind: "RECEIPT",
      occurredAt: daysAgo(9),
      createdById: author(),
      lines: { create: [{ direction: "IN", location: "WAREHOUSE", itemTypeId: roll.id, qty: 4, unitCost: 250_000 }] },
    },
  });
  const orderB = await prisma.supplierOrder.create({
    data: {
      supplierId: suppliers[1].id,
      itemTypeId: roll.id,
      orderDate: daysAgo(12),
      status: "PARTIAL_RECEIVED",
      expectedQty: 6,
      expectedTotal: 1_500_000,
      createdById: adminId,
      receipts: {
        create: {
          receivedQty: 4,
          goodsCost: 1_000_000,
          transportCost: 0,
          receivedAt: daysAgo(9),
          createdById: author(),
          eventId: evRcptB.id,
        },
      },
    },
  });
  // Supplier payments (placed on recent/open days so daily closes stay tidy).
  for (const [orderId, supplierId, amount, o] of [
    [orderA.id, suppliers[0].id, 1_500_000, 10],
    [orderA.id, suppliers[0].id, 1_000_000, 6],
    [orderB.id, suppliers[1].id, 500_000, 8],
  ] as const) {
    await prisma.supplierPayment.create({
      data: { supplierId, orderId, amount, paymentDate: daysAgo(o), method: "CASH", createdById: author() },
    });
    addPaidOut(o, amount);
  }

  // ── Tailor flow: send uncut pieces → return sewn (with a little loss) ──
  await prisma.inventoryEvent.create({
    data: {
      kind: "TAILOR_SEND",
      occurredAt: daysAgo(24, 9),
      notes: "ချုပ်ရန် ပို့ (draft)",
      createdById: adminId,
      lines: {
        create: [
          { direction: "OUT", location: "WAREHOUSE", itemTypeId: byKey["MA_CHOOK_YA_THE"].id, qty: 100 },
          { direction: "IN", location: "TAILOR", tailorId: tailors[0].id, itemTypeId: byKey["MA_CHOOK_YA_THE"].id, qty: 100 },
        ],
      },
    },
  });
  await prisma.inventoryEvent.create({
    data: {
      kind: "TAILOR_RETURN",
      occurredAt: daysAgo(18, 16),
      notes: "ချုပ်ပြီး ပြန်ရ — အလျော့ ၄ ထည် (draft)",
      createdById: adminId,
      lines: {
        create: [
          { direction: "OUT", location: "TAILOR", tailorId: tailors[0].id, itemTypeId: byKey["MA_CHOOK_YA_THE"].id, qty: 100 },
          { direction: "IN", location: "WAREHOUSE", itemTypeId: byKey["CHOK_KWIN"].id, qty: 96, unitCost: ECON.CHOK_KWIN.cost },
        ],
      },
    },
  });
  const tailorFee = 96 * (tailors[0].defaultFeePerPiece ?? 1_500);
  await prisma.tailorPayment.create({
    data: { tailorId: tailors[0].id, amount: tailorFee, paymentDate: daysAgo(18), method: "CASH", createdById: adminId },
  });
  addPaidOut(18, tailorFee);

  // ── A month of sales (+ matching SALE events + payments) ───────────
  const walkInNames = ["ဝင်ရောက်ဝယ်သူ", "ဧည့်သည်", "လမ်းသွား ဝယ်သူ"];
  type MadeSale = { id: number; offset: number; lines: { itemTypeId: number; qty: number; unitPrice: number }[] };
  const madeSales: MadeSale[] = [];

  for (let o = 29; o >= 0; o--) {
    const salesToday = randInt(1, 3);
    for (let s = 0; s < salesToday; s++) {
      const when = daysAgo(o, randInt(9, 18));
      const onAccount = chance(0.6);
      const customer = onAccount ? pick(customers) : null;
      const kind = customer?.defaultKind ?? (chance(0.5) ? "WHOLESALE" : "RETAIL");

      // 1–3 catalog lines.
      const nLines = randInt(1, 3);
      const chosen = [...sellable].sort(() => rand() - 0.5).slice(0, nLines);
      const catalog = chosen.map((t) => {
        const qty = randInt(1, kind === "WHOLESALE" ? 12 : 4);
        const base = ECON[t.key]?.sell ?? 10_000;
        const unitPrice = kind === "RETAIL" ? Math.round(base * 1.1) : base;
        return { itemTypeId: t.id, qty, unitPrice, lineTotal: qty * unitPrice };
      });
      const goodsTotal = catalog.reduce((sum, l) => sum + l.lineTotal, 0);
      const discount = chance(0.2) ? randInt(1, 5) * 1_000 : 0;
      const grandTotal = goodsTotal - discount;

      // Payment scenario.
      let paidAmount = grandTotal;
      let status: "UNPAID" | "PARTIAL" | "PAID" = "PAID";
      if (onAccount) {
        const r = rand();
        if (r < 0.6) {
          paidAmount = grandTotal;
          status = "PAID";
        } else if (r < 0.85) {
          paidAmount = Math.round((grandTotal * randInt(30, 70)) / 100 / 1000) * 1000;
          status = paidAmount === 0 ? "UNPAID" : "PARTIAL";
        } else {
          paidAmount = 0;
          status = "UNPAID";
        }
      }

      // An occasional free / replacement ad-hoc line (price 0, requires a note).
      const adhoc =
        chance(0.08)
          ? [{ itemTypeId: null, itemName: "အစားထိုး/လက်ဆောင်", qty: 1, unitPrice: 0, lineTotal: 0, note: "အခမဲ့ — အစားထိုး (draft)" }]
          : [];

      const createdById = author();
      const sale = await prisma.sale.create({
        data: {
          saleDate: when,
          customerId: customer?.id ?? null,
          customerName: customer ? null : pick(walkInNames),
          kind,
          goodsTotal,
          discount,
          grandTotal,
          paidAmount,
          status,
          createdById,
          createdAt: when,
          lines: { create: [...catalog.map((l) => ({ ...l })), ...adhoc] },
        },
      });
      await prisma.inventoryEvent.create({
        data: {
          kind: "SALE",
          occurredAt: when,
          saleId: sale.id,
          createdById,
          lines: { create: catalog.map((l) => ({ direction: "OUT" as const, location: "SHOP" as const, itemTypeId: l.itemTypeId, qty: l.qty })) },
        },
      });

      if (paidAmount > 0) {
        await prisma.customerPayment.create({
          data: {
            customerId: customer?.id ?? null,
            saleId: sale.id,
            amount: paidAmount,
            paymentDate: when,
            method: "CASH",
            createdById,
          },
        });
        addReceived(o, paidAmount);
      }

      madeSales.push({ id: sale.id, offset: o, lines: catalog });
    }
  }

  // A couple of later repayments against earlier credit sales.
  for (const ms of madeSales.filter((m) => m.offset >= 18).slice(0, 4)) {
    const sale = await prisma.sale.findUnique({ where: { id: ms.id } });
    if (!sale || !sale.customerId || sale.status === "PAID") continue;
    const owed = sale.grandTotal - sale.paidAmount;
    if (owed <= 0) continue;
    const payOffset = Math.max(0, ms.offset - randInt(5, 12));
    await prisma.customerPayment.create({
      data: { customerId: sale.customerId, saleId: sale.id, amount: owed, paymentDate: daysAgo(payOffset), method: "CASH", createdById: author() },
    });
    await prisma.sale.update({ where: { id: sale.id }, data: { paidAmount: sale.grandTotal, status: "PAID" } });
    addReceived(payOffset, owed);
  }

  // ── Returns / refunds (RETURN_FROM_CUSTOMER + cash back) ───────────
  for (const ms of madeSales.filter((m) => m.offset >= 6 && m.lines.length > 0).slice(0, 3)) {
    const line = ms.lines[0];
    const qty = Math.max(1, Math.min(line.qty, randInt(1, 2)));
    const returnTotal = qty * line.unitPrice;
    const refundAmount = chance(0.6) ? returnTotal : 0; // else store credit
    const rOffset = Math.max(0, ms.offset - 1);
    const saleRow = await prisma.sale.findUnique({ where: { id: ms.id } });
    const evReturn = await prisma.inventoryEvent.create({
      data: {
        kind: "RETURN_FROM_CUSTOMER",
        occurredAt: daysAgo(rOffset),
        createdById: author(),
        lines: { create: [{ direction: "IN", location: "SHOP", itemTypeId: line.itemTypeId, qty }] },
      },
    });
    await prisma.saleReturn.create({
      data: {
        saleId: ms.id,
        customerId: saleRow?.customerId ?? null,
        returnDate: daysAgo(rOffset),
        returnTotal,
        refundAmount,
        notes: "ပစ္စည်း ပြန်အမ်း (draft)",
        createdById: author(),
        eventId: evReturn.id,
        lines: { create: [{ itemTypeId: line.itemTypeId, qty, unitPrice: line.unitPrice, lineTotal: returnTotal }] },
      },
    });
    if (refundAmount > 0) addPaidOut(rOffset, refundAmount);
  }

  // ── A manual ADJUSTMENT (stock count correction) ───────────────────
  await prisma.inventoryEvent.create({
    data: {
      kind: "ADJUSTMENT",
      occurredAt: daysAgo(5, 19),
      notes: "ရေတွက်ပြီး ပြင်ဆင် (draft)",
      createdById: adminId,
      lines: { create: [{ direction: "IN", location: "SHOP", itemTypeId: byKey["CHIBAUNG_THAR"].id, qty: 5 }] },
    },
  });

  // ── One open stock exception (oversell worklist), linked to a sale ─
  const oversellSale = madeSales.find((m) => m.lines.some((l) => l.itemTypeId === byKey["MIKLYO"].id));
  if (oversellSale) {
    await prisma.stockException.create({
      data: {
        itemTypeId: byKey["MIKLYO"].id,
        location: "SHOP",
        status: "OPEN",
        firstDetectedAt: daysAgo(3),
        lastDetectedAt: daysAgo(2),
        notes: "ဆိုင်လက်ကျန်ထက် ပိုရောင်း (draft)",
        sales: { create: [{ saleId: oversellSale.id, qtyBeyond: 3 }] },
      },
    });
  }

  // ── Operating expenses ─────────────────────────────────────────────
  const cats = Object.fromEntries((await prisma.expenseCategory.findMany()).map((c) => [c.key, c.id]));
  const expenses: { categoryKey: string; amount: number; offset: number; paidToEmployeeId?: number; paidToDriverId?: number; paidTo?: string }[] = [
    { categoryKey: "shop_rent", amount: 150_000, offset: 28, paidTo: "ဆိုင်ရှင်" },
    { categoryKey: "utilities", amount: 40_000, offset: 14 },
    { categoryKey: "transport", amount: 30_000, offset: 20, paidToDriverId: drivers[0].id },
    { categoryKey: "transport", amount: 25_000, offset: 7, paidToDriverId: drivers[1].id },
    { categoryKey: "misc", amount: 15_000, offset: 5 },
    { categoryKey: "salary", amount: employees[0].monthlySalary ?? 250_000, offset: 2, paidToEmployeeId: employees[0].id },
    { categoryKey: "salary", amount: employees[1].monthlySalary ?? 280_000, offset: 2, paidToEmployeeId: employees[1].id },
  ];
  for (const e of expenses) {
    await prisma.expense.create({
      data: {
        expenseDate: daysAgo(e.offset),
        categoryId: cats[e.categoryKey],
        amount: e.amount,
        paidTo: e.paidTo,
        paidToEmployeeId: e.paidToEmployeeId,
        paidToDriverId: e.paidToDriverId,
        createdById: author(),
      },
    });
    addPaidOut(e.offset, e.amount);
  }

  // ── Daily closes for older days (recent ~11 days left open) ─────────
  let prevCarry = 0;
  let closes = 0;
  for (let o = 29; o >= 12; o--) {
    const acc = byDay[o] ?? { received: 0, paidOut: 0 };
    const openingCash = prevCarry;
    const expectedCash = openingCash + acc.received - acc.paidOut;
    const variance = chance(0.25) ? (chance(0.5) ? -1 : 1) * randInt(1, 6) * 1_000 : 0;
    const countedCash = expectedCash + variance;
    const carryForward = chance(0.4) ? pick([50_000, 100_000]) : 0;
    await prisma.dailyClose.create({
      data: {
        closeDate: midnight(o),
        openingCash,
        receivedTotal: acc.received,
        paidOutTotal: acc.paidOut,
        expectedCash,
        countedCash,
        carryForward,
        difference: countedCash - expectedCash,
        closedById: adminId,
        closedAt: daysAgo(o, 20),
      },
    });
    prevCarry = carryForward;
    closes++;
  }

  // ── Demo shop settings (drives the receipt header/footer) ───────────
  await prisma.shopSetting.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      shopName: "မင်္ဂလာ အထည်ဆိုင် (Demo)",
      addressLine: "အမှတ် ၁၂၃၊ ဗိုလ်ချုပ်လမ်း၊ ရန်ကုန်",
      phone: "09-444 555 666",
      social: "fb.com/lgy.demo",
      receiptHeader: "ရောင်းချဖြတ်ပိုင်း",
      receiptFooter: "ကျေးဇူးတင်ပါသည်! ၃ ရက်အတွင်း ဘောက်ချာဖြင့် လဲလှယ်နိုင်ပါသည်။",
      updatedById: adminId,
    },
  });

  console.log(
    `✔ Demo: ${customers.length} customers · ${suppliers.length} suppliers · ${tailors.length} tailors · ` +
      `${drivers.length} drivers · ${employees.length} employees`,
  );
  console.log(`✔ Demo: ${madeSales.length} sales · 2 supplier orders · ${closes} daily closes · expenses, returns, tailor flow`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
