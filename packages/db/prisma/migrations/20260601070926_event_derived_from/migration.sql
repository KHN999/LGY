-- AlterTable
ALTER TABLE "InventoryEvent" ADD COLUMN     "relatedEventId" INTEGER;

-- AddForeignKey
ALTER TABLE "InventoryEvent" ADD CONSTRAINT "InventoryEvent_relatedEventId_fkey" FOREIGN KEY ("relatedEventId") REFERENCES "InventoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
