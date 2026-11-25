CREATE TYPE "BillingRequestStatus" AS ENUM (
    'NOT_REQUESTED',
    'REQUESTED',
    'DECLINED'
);

ALTER TABLE "Order"
    ADD COLUMN "billingRequestStatus" "BillingRequestStatus" NOT NULL DEFAULT 'NOT_REQUESTED';

ALTER TABLE "BillingDocument"
    ADD COLUMN "requestPayload" JSONB;

CREATE TABLE "BillingDocumentOrder" (
    "billingDocumentId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,

    CONSTRAINT "BillingDocumentOrder_pkey" PRIMARY KEY ("billingDocumentId", "orderId")
);

INSERT INTO "BillingDocumentOrder" ("billingDocumentId", "orderId")
SELECT "id", "orderId"
FROM "BillingDocument"
WHERE "orderId" IS NOT NULL;

CREATE UNIQUE INDEX "BillingDocumentOrder_orderId_key"
    ON "BillingDocumentOrder"("orderId");

ALTER TABLE "BillingDocumentOrder"
    ADD CONSTRAINT "BillingDocumentOrder_billingDocumentId_fkey"
    FOREIGN KEY ("billingDocumentId") REFERENCES "BillingDocument"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BillingDocumentOrder"
    ADD CONSTRAINT "BillingDocumentOrder_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
