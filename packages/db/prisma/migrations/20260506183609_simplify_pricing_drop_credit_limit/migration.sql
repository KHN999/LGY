/*
  Warnings:

  - You are about to drop the column `expectedUnitPrice` on the `SupplierOrder` table. All the data in the column will be lost.
  - You are about to drop the column `totalExpected` on the `SupplierOrder` table. All the data in the column will be lost.
  - You are about to drop the column `unitPrice` on the `SupplierOrderReceipt` table. All the data in the column will be lost.
  - Added the required column `expectedTotal` to the `SupplierOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `goodsCost` to the `SupplierOrderReceipt` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "SupplierOrder" DROP COLUMN "expectedUnitPrice",
DROP COLUMN "totalExpected",
ADD COLUMN     "expectedTotal" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "SupplierOrderReceipt" DROP COLUMN "unitPrice",
ADD COLUMN     "goodsCost" INTEGER NOT NULL;
