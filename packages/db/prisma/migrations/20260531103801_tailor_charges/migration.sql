-- CreateTable
CREATE TABLE "TailorCharge" (
    "id" SERIAL NOT NULL,
    "tailorId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "pieces" INTEGER,
    "feePerPiece" INTEGER,
    "note" TEXT,
    "chargeDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" INTEGER,
    "voidReason" TEXT,

    CONSTRAINT "TailorCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TailorCharge_tailorId_chargeDate_idx" ON "TailorCharge"("tailorId", "chargeDate");

-- AddForeignKey
ALTER TABLE "TailorCharge" ADD CONSTRAINT "TailorCharge_tailorId_fkey" FOREIGN KEY ("tailorId") REFERENCES "Tailor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailorCharge" ADD CONSTRAINT "TailorCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TailorCharge" ADD CONSTRAINT "TailorCharge_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
