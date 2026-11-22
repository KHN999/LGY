/**
 * Apply pending migrations to EVERY shop schema: public, playground, and each
 * shop created from the admin app (listed in public."Shop").
 *
 *   pnpm --filter @lgy/db migrate:all
 *
 * Run this whenever a migration is added, BEFORE deploying code that needs it.
 * Uses `prisma migrate deploy` per schema — it never resets or re-seeds.
 * DATABASE_URL is read from the environment, falling back to packages/db/.env.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const dbDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let base = process.env.DATABASE_URL;
if (!base) {
  const envText = readFileSync(resolve(dbDir, ".env"), "utf8");
  base = envText.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1];
}
if (!base) {
  console.error("DATABASE_URL not found (env or packages/db/.env)");
  process.exit(1);
}
const urlFor = (schema) => {
  const u = new URL(base);
  u.searchParams.set("schema", schema);
  return u.toString();
};
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const deploy = (schema) => {
  console.log(`\n▶ migrate deploy → "${schema}"`);
  execFileSync(pnpm, ["exec", "prisma", "migrate", "deploy"], {
    cwd: dbDir,
    env: { ...process.env, DATABASE_URL: urlFor(schema) },
    stdio: "inherit",
  });
};

// public first: the registry lives there (and may itself be the pending migration).
deploy("public");

const db = new PrismaClient({ datasources: { db: { url: urlFor("public") } } });
let schemas = ["playground"];
try {
  const rows = await db.shop.findMany({ orderBy: { id: "asc" } });
  schemas = rows.map((r) => r.schema).filter((s) => s !== "public");
} finally {
  await db.$disconnect();
}
for (const schema of schemas) deploy(schema);
console.log(`\n✔ ${schemas.length + 1} schema(s) up to date: public, ${schemas.join(", ")}`);
