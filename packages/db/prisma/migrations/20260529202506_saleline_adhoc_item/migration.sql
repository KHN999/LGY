-- DropForeignKey
ALTER TABLE "SaleLine" DROP CONSTRAINT "SaleLine_itemTypeId_fkey";

-- AlterTable
ALTER TABLE "SaleLine" ADD COLUMN     "itemName" TEXT,
ALTER COLUMN "itemTypeId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "ItemType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
