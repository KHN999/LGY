-- Manual bank movements: deposits, withdrawals, and "the balance is X" set points.
CREATE TABLE "BankTxn" (
    "id" SERIAL NOT NULL,
    "bank" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "cashSide" BOOLEAN NOT NULL DEFAULT true,
    "txnDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" INTEGER,

    CONSTRAINT "BankTxn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BankTxn_bank_txnDate_idx" ON "BankTxn"("bank", "txnDate");

-- Which bank a non-cash supplier / tailor payment went out of.
ALTER TABLE "SupplierPayment" ADD COLUMN "bank" TEXT;
ALTER TABLE "TailorPayment" ADD COLUMN "bank" TEXT;
