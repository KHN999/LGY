/**
 * Resync every autoincrement `id` sequence to its table's MAX(id), across all
 * shop schemas. Safe + idempotent: if a sequence is already correct this is a
 * no-op; if it is behind (e.g. data was loaded via a dump/restore that never
 * advanced the sequence) it is fixed so the next INSERT stops colliding.
 *
 *   DATABASE_URL='postgresql://…' node scripts/resync-sequences.mjs        # report only
 *   DATABASE_URL='postgresql://…' node scripts/resync-sequences.mjs --fix  # report + fix
 *
 * One run covers every schema below regardless of the connection's schema param,
 * because it addresses tables/sequences by fully-qualified name.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const FIX = process.argv.includes("--fix");
const SCHEMAS = ["public", "playground"];

async function main() {
  const schemaList = SCHEMAS.map((s) => `'${s}'`).join(", ");
  const tables = await prisma.$queryRawUnsafe(`
    SELECT table_schema AS schema, table_name AS name
    FROM information_schema.columns
    WHERE column_name = 'id'
      AND table_schema IN (${schemaList})
      AND column_default LIKE 'nextval%'
    ORDER BY table_schema, table_name
  `);

  if (tables.length === 0) {
    console.log("No id-sequence-backed tables found in:", SCHEMAS.join(", "));
    return;
  }

  let behindCount = 0;
  console.log(`Scanning ${tables.length} tables across [${SCHEMAS.join(", ")}]${FIX ? "  (FIX MODE)" : "  (report only)"}\n`);

  for (const { schema, name } of tables) {
    const seqRow = await prisma.$queryRawUnsafe(
      `SELECT pg_get_serial_sequence('"${schema}"."${name}"', 'id') AS seq`,
    );
    const seq = seqRow[0]?.seq;
    if (!seq) continue;

    const maxRow = await prisma.$queryRawUnsafe(`SELECT COALESCE(MAX(id), 0)::bigint AS m FROM "${schema}"."${name}"`);
    const maxId = Number(maxRow[0].m);
    const lastRow = await prisma.$queryRawUnsafe(`SELECT pg_sequence_last_value('${seq}'::regclass) AS l`);
    const last = lastRow[0].l === null ? null : Number(lastRow[0].l);

    const behind = maxId > 0 && (last === null || last < maxId);
    if (behind) {
      behindCount++;
      console.log(`  ⚠️  BEHIND  ${schema}.${name}: sequence=${last ?? "unused"}  max(id)=${maxId}`);
      if (FIX) {
        await prisma.$queryRawUnsafe(`SELECT setval('${seq}'::regclass, ${maxId}, true)`);
        console.log(`      → fixed: next id will be ${maxId + 1}`);
      }
    }
  }

  console.log("");
  if (behindCount === 0) {
    console.log("✅ All sequences are in sync — nothing to fix.");
  } else if (FIX) {
    console.log(`✅ Resynced ${behindCount} behind sequence(s).`);
  } else {
    console.log(`Found ${behindCount} behind sequence(s). Re-run with --fix to repair.`);
  }
}

main()
  .catch((e) => {
    console.error("resync failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
