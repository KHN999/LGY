/**
 * Set up (or update) a shop's isolated Postgres schema: ensure the schema
 * exists, apply all migrations to it, and seed the baseline rows.
 *
 *   node scripts/setup-shop.mjs <schema>      # e.g. playground
 *
 * The "main" shop lives in the default `public` schema and uses the normal
 * `prisma migrate deploy` / `prisma db seed` flow. Run this for every extra
 * shop schema, and re-run it after adding migrations so the schema keeps up.
 *
 * DATABASE_URL is read from the environment, falling back to packages/db/.env.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const dbDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const schema = process.argv[2];
if (!schema || !/^[a-z_][a-z0-9_]*$/i.test(schema)) {
  console.error("Usage: node scripts/setup-shop.mjs <schema>  (alphanumeric/underscore)");
  process.exit(1);
}

let base = process.env.DATABASE_URL;
if (!base) {
  const envText = readFileSync(resolve(dbDir, ".env"), "utf8");
  base = envText.match(/^DATABASE_URL\s*=\s*"?([^"\n]+)"?/m)?.[1];
}
if (!base) {
  console.error("DATABASE_URL not found (env or packages/db/.env)");
  process.exit(1);
}

const schemaUrl = new URL(base);
schemaUrl.searchParams.set("schema", schema);

const baseEnv = { ...process.env, DATABASE_URL: base };
const schemaEnv = { ...process.env, DATABASE_URL: schemaUrl.toString() };
const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";

console.log(`▶ ensure schema "${schema}" exists`);
execFileSync(
  pnpm,
  ["exec", "prisma", "db", "execute", "--stdin", "--schema", "prisma/schema.prisma"],
  { cwd: dbDir, env: baseEnv, input: `CREATE SCHEMA IF NOT EXISTS "${schema}";`, stdio: ["pipe", "inherit", "inherit"] },
);

console.log(`▶ apply migrations → "${schema}"`);
execFileSync(pnpm, ["exec", "prisma", "migrate", "deploy"], { cwd: dbDir, env: schemaEnv, stdio: "inherit" });

console.log(`▶ seed baseline → "${schema}"`);
execFileSync(pnpm, ["exec", "tsx", "prisma/seed.ts"], { cwd: dbDir, env: schemaEnv, stdio: "inherit" });

console.log(`✔ shop schema "${schema}" ready`);
