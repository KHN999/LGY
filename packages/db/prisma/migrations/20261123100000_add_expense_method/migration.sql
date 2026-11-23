-- How an expense was paid. Existing rows were all treated as cash.
ALTER TABLE "Expense" ADD COLUMN "method" "PaymentMethod" NOT NULL DEFAULT 'CASH';
ALTER TABLE "Expense" ADD COLUMN "bank" TEXT;
