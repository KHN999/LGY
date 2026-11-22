-- CreateTable
CREATE TABLE "Shop" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "schema" TEXT NOT NULL,
    "sandbox" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_key_key" ON "Shop"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_schema_key" ON "Shop"("schema");

-- The two shops that existed before the registry. (The table is created in every
-- shop schema because all schemas share one migration history, but only the
-- copy in `public` is ever read.)
INSERT INTO "Shop" ("key", "name", "schema", "sandbox") VALUES
  ('main', 'Main', 'public', false),
  ('playground', 'Test', 'playground', true);
