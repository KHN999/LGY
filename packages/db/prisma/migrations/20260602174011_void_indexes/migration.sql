-- CreateIndex
CREATE INDEX "CustomerPayment_customerId_voidedAt_idx" ON "CustomerPayment"("customerId", "voidedAt");

-- CreateIndex
CREATE INDEX "InventoryEvent_voidedAt_idx" ON "InventoryEvent"("voidedAt");

-- CreateIndex
CREATE INDEX "Sale_customerId_voidedAt_idx" ON "Sale"("customerId", "voidedAt");

-- CreateIndex
CREATE INDEX "SaleReturn_customerId_voidedAt_idx" ON "SaleReturn"("customerId", "voidedAt");

-- CreateIndex
CREATE INDEX "SupplierOrderReceipt_orderId_voidedAt_idx" ON "SupplierOrderReceipt"("orderId", "voidedAt");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierId_voidedAt_idx" ON "SupplierPayment"("supplierId", "voidedAt");

-- CreateIndex
CREATE INDEX "TailorCharge_tailorId_voidedAt_idx" ON "TailorCharge"("tailorId", "voidedAt");

-- CreateIndex
CREATE INDEX "TailorPayment_tailorId_voidedAt_idx" ON "TailorPayment"("tailorId", "voidedAt");
