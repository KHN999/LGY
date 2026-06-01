-- AlterTable
ALTER TABLE "SupplierOrderReceipt" ADD COLUMN     "voidReason" TEXT,
ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedById" INTEGER;

-- AddForeignKey
ALTER TABLE "SupplierOrderReceipt" ADD CONSTRAINT "SupplierOrderReceipt_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
