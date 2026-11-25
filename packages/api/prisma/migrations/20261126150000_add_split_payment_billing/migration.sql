ALTER TABLE "Payment"
ADD COLUMN "billingRequestStatus" "BillingRequestStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
ADD COLUMN "billingDocumentId" TEXT,
ADD COLUMN "payerGroupId" TEXT;

DROP INDEX IF EXISTS "BillingDocumentOrder_orderId_key";

CREATE INDEX "BillingDocumentOrder_orderId_idx"
ON "BillingDocumentOrder"("orderId");

CREATE INDEX "Payment_billingDocumentId_idx"
ON "Payment"("billingDocumentId");

CREATE INDEX "Payment_payerGroupId_idx"
ON "Payment"("payerGroupId");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_billingDocumentId_fkey"
FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
