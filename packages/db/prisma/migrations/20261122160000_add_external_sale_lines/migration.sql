-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "externalTotal" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN "external" BOOLEAN NOT NULL DEFAULT false;
