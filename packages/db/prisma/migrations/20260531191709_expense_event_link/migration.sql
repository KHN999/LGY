-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "eventId" INTEGER;

-- CreateIndex
CREATE INDEX "Expense_eventId_idx" ON "Expense"("eventId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InventoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
