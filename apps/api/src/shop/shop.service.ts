import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { BadRequestException, Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import { PrismaService, urlForSchema } from "../prisma/prisma.service";
import { getActiveShop, getShop, listShops, schemaForShop } from "../prisma/shop-context";
import { CreateShopDto } from "./dto/switch-shop.dto";

const run = promisify(execFile);

/** What a new shop can inherit: the option name → the table copied for it.
 *  Only master data — never sales, payments, stock movements or closes. */
const COPYABLE = {
  itemTypes: "ItemType",
  customers: "Customer",
  suppliers: "Supplier",
  tailors: "Tailor",
  drivers: "Driver",
  employees: "Employee",
  settings: "ShopSetting",
} as const;
/** Always copied: accounts (every record points at who made it) and expense
 *  categories (the app needs them, e.g. for a transfer's delivery fee). */
const ALWAYS = ["User", "ExpenseCategory"];
type CopyKey = keyof typeof COPYABLE;

/** `packages/db`, found by walking up from the working directory (repo root in
 *  production, `apps/api` in dev). */
function findDbDir(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, "packages", "db");
    if (existsSync(join(candidate, "prisma", "schema.prisma"))) return candidate;
    dir = dirname(dir);
  }
  throw new Error("packages/db not found from " + process.cwd());
}

@Injectable()
export class ShopService {
  private readonly log = new Logger("ShopService");
  constructor(private readonly prisma: PrismaService) {}

  /** Whether this server can build a new shop: it needs the migration files and
   *  the Prisma CLI on disk. Reported up front so the page can say so. */
  readiness(): { ready: boolean; reason?: string } {
    try {
      const dbDir = findDbDir();
      createRequire(join(dbDir, "package.json")).resolve("prisma/build/index.js");
      if (!existsSync(join(dbDir, "prisma", "migrations"))) return { ready: false, reason: "migrations folder missing" };
      return { ready: true };
    } catch (e) {
      return { ready: false, reason: (e as Error).message.slice(0, 200) };
    }
  }

  list() {
    return listShops().map(({ key, name, sandbox }) => ({ key, name, sandbox }));
  }

  /**
   * Create a shop: a new Postgres schema with the full table structure, the
   * user accounts (always — every record points at who made it), and whichever
   * master data was ticked, copied from the shop this request is in. Nothing
   * that carries money, stock or history is copied, so the new shop starts at
   * zero. If any step fails the half-built schema is removed again.
   */
  async create(dto: CreateShopDto, createdById: number) {
    const name = dto.name.normalize("NFC").trim();
    if (!name) throw new BadRequestException("Shop name is required");
    if (listShops().some((s) => s.name.trim().toLowerCase() === name.toLowerCase())) {
      throw new BadRequestException("A shop with that name already exists");
    }
    const main = this.prisma.main;
    const source = getActiveShop();
    const src = schemaForShop(source);

    // Schema name is generated here, never taken from user input.
    const taken = new Set(
      (await main.$queryRaw<{ schema_name: string }[]>`SELECT schema_name FROM information_schema.schemata`).map(
        (r) => r.schema_name,
      ),
    );
    let n = (await main.shop.count()) + 1;
    while (taken.has(`shop_${n}`) || getShop(`shop_${n}`)) n++;
    const schema = `shop_${n}`;
    const key = schema;

    await main.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    try {
      await this.migrate(schema);

      const tables = [...ALWAYS, ...(Object.keys(COPYABLE) as CopyKey[]).filter((k) => dto[k]).map((k) => COPYABLE[k])];
      const copied: Record<string, number> = {};
      await main.$transaction(
        async (tx) => {
          for (const table of tables) {
            // Columns as they exist in the NEW schema; enum columns are cast by
            // name because each schema has its own copy of every enum type.
            const cols = await tx.$queryRaw<{ column_name: string; data_type: string; udt_name: string }[]>`
              SELECT column_name, data_type, udt_name FROM information_schema.columns
              WHERE table_schema = ${schema} AND table_name = ${table} ORDER BY ordinal_position`;
            const names = cols.map((c) => `"${c.column_name}"`).join(", ");
            const values = cols
              .map((c) =>
                c.data_type === "USER-DEFINED"
                  ? `"${c.column_name}"::text::"${schema}"."${c.udt_name}"`
                  : `"${c.column_name}"`,
              )
              .join(", ");
            // Deleted customers stay behind; so does who last edited the settings.
            const where = table === "Customer" ? ` WHERE "deletedAt" IS NULL` : "";
            // Accounts always come from public, where the canonical copy lives.
            const from = table === "User" ? "public" : src;
            copied[table] = await tx.$executeRawUnsafe(
              `INSERT INTO "${schema}"."${table}" (${names}) SELECT ${values} FROM "${from}"."${table}"${where}`,
            );
            // New rows must not collide with the ids just copied.
            await tx.$executeRawUnsafe(
              `SELECT setval(pg_get_serial_sequence('"${schema}"."${table}"', 'id'),
                 GREATEST((SELECT COALESCE(MAX(id), 0) FROM "${schema}"."${table}"), 1),
                 (SELECT COUNT(*) > 0 FROM "${schema}"."${table}"))`,
            );
          }
        },
        { timeout: 120_000, maxWait: 20_000 },
      );

      // The registry row the migration seeded inside the new schema is unused;
      // the real registry is in public.
      await main.shop.create({ data: { key, name, schema, sandbox: false, createdById } });
      await this.prisma.reloadShops();
      this.log.log(`Created shop ${key} "${name}" from ${source}: ${JSON.stringify(copied)}`);
      return { key, name, sandbox: false, copiedFrom: source, copied };
    } catch (e) {
      // Remove only the schema this call created a moment ago.
      await main.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`).catch(() => undefined);
      this.log.error(`Create shop failed: ${(e as Error).message}`);
      if (e instanceof BadRequestException) throw e;
      throw new InternalServerErrorException(`Could not create the shop: ${(e as Error).message.slice(0, 300)}`);
    }
  }

  /** Build the table structure in a schema by running Prisma's own
   *  `migrate deploy` against it, so its migration history matches the other
   *  shops and future migrations apply cleanly. */
  private async migrate(schema: string): Promise<void> {
    const dbDir = findDbDir();
    const cli = createRequire(join(dbDir, "package.json")).resolve("prisma/build/index.js");
    await run(process.execPath, [cli, "migrate", "deploy", "--schema", resolve(dbDir, "prisma", "schema.prisma")], {
      cwd: dbDir,
      env: { ...process.env, DATABASE_URL: urlForSchema(schema) },
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
    });
  }
}
