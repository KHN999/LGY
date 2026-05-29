-- CreateEnum
CREATE TYPE "SupplierOrderStatus" AS ENUM ('PENDING', 'PARTIAL_RECEIVED', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "orderId" INTEGER;

-- CreateTable
CREATE TABLE "SupplierOrder" (
    "id" SERIAL NOT NULL,
    "supplierId" INTEGER NOT NULL,
    "itemTypeId" INTEGER NOT NULL,
    "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "SupplierOrderStatus" NOT NULL DEFAULT 'PENDING',
    "expectedQty" INTEGER NOT NULL,
    "expectedUnitPrice" INTEGER NOT NULL,
    "totalExpected" INTEGER NOT NULL,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierOrderReceipt" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "transportCost" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "eventId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierOrderReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierOrder_supplierId_orderDate_idx" ON "SupplierOrder"("supplierId", "orderDate");

-- CreateIndex
CREATE INDEX "SupplierOrder_status_idx" ON "SupplierOrder"("status");

-- CreateIndex
CREATE INDEX "SupplierOrder_itemTypeId_idx" ON "SupplierOrder"("itemTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierOrderReceipt_eventId_key" ON "SupplierOrderReceipt"("eventId");

-- CreateIndex
CREATE INDEX "SupplierOrderReceipt_orderId_idx" ON "SupplierOrderReceipt"("orderId");

-- CreateIndex
CREATE INDEX "SupplierPayment_orderId_idx" ON "SupplierPayment"("orderId");

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplierOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_itemTypeId_fkey" FOREIGN KEY ("itemTypeId") REFERENCES "ItemType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrder" ADD CONSTRAINT "SupplierOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderReceipt" ADD CONSTRAINT "SupplierOrderReceipt_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "SupplierOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderReceipt" ADD CONSTRAINT "SupplierOrderReceipt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "InventoryEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierOrderReceipt" ADD CONSTRAINT "SupplierOrderReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
