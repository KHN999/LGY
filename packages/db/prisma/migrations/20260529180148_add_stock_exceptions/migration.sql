-- CreateEnum
CREATE TYPE "StockExceptionStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "StockException" (
    "id" SERIAL NOT NULL,
    "itemTypeId" INTEGER NOT NULL,
    "location" "Location" NOT NULL DEFAULT 'SHOP',
    "status" "StockExceptionStatus" NOT NULL DEFAULT 'OPEN',
    "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" INTEGER,
    "resolutionEventId" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockExceptionSale" (
    "id" SERIAL NOT NULL,
    "exceptionId" INTEGER NOT NULL,
    "saleId" INTEGER NOT NULL,
    "qtyBeyond" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockExceptionSale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StockException_status_location_idx" ON "StockException"("status", "location");

-- CreateIndex
CREATE INDEX "StockException_itemTypeId_idx" ON "StockException"("itemTypeId");

-- CreateIndex
CREATE INDEX "StockExceptionSale_exceptionId_idx" ON "StockExceptionSale"("exceptionId");

-- CreateIndex
CREATE INDEX "StockExceptionSale_saleId_idx" ON "StockExceptionSale"("saleId");

-- AddForeignKey
ALTER TABLE "StockException" ADD CONSTRAINT "StockException_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "ItemType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockException" ADD CONSTRAINT "StockException_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockException" ADD CONSTRAINT "StockException_resolutionEventId_fkey" FOREIGN KEY ("resolutionEventId") REFERENCES "InventoryEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExceptionSale" ADD CONSTRAINT "StockExceptionSale_exceptionId_fkey" FOREIGN KEY ("exceptionId") REFERENCES "StockException"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockExceptionSale" ADD CONSTRAINT "StockExceptionSale_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
