import { PrismaClient, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── Admin user ───────────────────────────────────────────────
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

  // ─── Item types ───────────────────────────────────────────────
  // Owner edits these from /admin/item-types. Seed the known ones; the missing
  // 6th cut-output type is added via UI when recalled.
  // ROLL is raw material (warehouse-only) — not sellable in the shop. The cut/sewn/
  // washed outputs are sellable. Owner can change `sellable` per item in /admin.
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

  // ─── Expense categories ───────────────────────────────────────
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
  console.log(`✔ Item types seeded: ${itemTypes.length}`);
  console.log(`✔ Expense categories seeded: ${categories.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
