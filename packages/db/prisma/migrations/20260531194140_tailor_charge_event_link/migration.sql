-- AlterTable
ALTER TABLE "TailorCharge" ADD COLUMN     "eventId" INTEGER;

-- CreateIndex
CREATE INDEX "TailorCharge_eventId_idx" ON "TailorCharge"("eventId");

-- AddForeignKey
ALTER TABLE "TailorCharge" ADD CONSTRAINT "TailorCharge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InventoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
