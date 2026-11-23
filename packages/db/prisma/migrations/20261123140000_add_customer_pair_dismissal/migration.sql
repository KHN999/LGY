-- Pairs of customers an admin confirmed are NOT the same person, so the
-- duplicate finder stops suggesting them.
CREATE TABLE "CustomerPairDismissal" (
    "aId" INTEGER NOT NULL,
    "bId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerPairDismissal_pkey" PRIMARY KEY ("aId","bId")
);
