-- A debt payment taken together with a sale (money handed over above that
-- sale's total). saleId stays NULL — it pays older debt — but the voucher of
-- the sale it came with can show it.
ALTER TABLE "CustomerPayment" ADD COLUMN "viaSaleId" INTEGER;
CREATE INDEX "CustomerPayment_viaSaleId_idx" ON "CustomerPayment"("viaSaleId");
