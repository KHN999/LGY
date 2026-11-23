-- What each customer merge moved, so it can be undone.
CREATE TABLE "CustomerMerge" (
    "id" SERIAL NOT NULL,
    "batchId" TEXT NOT NULL,
    "survivorId" INTEGER NOT NULL,
    "sourceId" INTEGER NOT NULL,
    "sourceStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "saleIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "paymentIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "returnIds" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "filledContact" BOOLEAN NOT NULL DEFAULT false,
    "filledNotes" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "CustomerMerge_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerMerge_batchId_idx" ON "CustomerMerge"("batchId");
CREATE INDEX "CustomerMerge_createdAt_idx" ON "CustomerMerge"("createdAt");
