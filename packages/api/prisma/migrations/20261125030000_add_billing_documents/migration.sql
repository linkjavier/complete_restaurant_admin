CREATE TYPE "BillingDocumentType" AS ENUM ('SALES_INVOICE');

CREATE TYPE "BillingDocumentStatus" AS ENUM (
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'FAILED_RETRYABLE',
    'RECONCILIATION_REQUIRED'
);

CREATE TABLE "BillingDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "orderId" TEXT,
    "countryCode" VARCHAR(2) NOT NULL,
    "providerName" TEXT NOT NULL,
    "type" "BillingDocumentType" NOT NULL,
    "status" "BillingDocumentStatus" NOT NULL DEFAULT 'PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "referenceCode" TEXT NOT NULL,
    "providerReferenceId" TEXT,
    "documentNumber" TEXT,
    "cufe" TEXT,
    "requestHash" TEXT NOT NULL,
    "responseMetadata" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingDocument_tenantId_locationId_idempotencyKey_key"
    ON "BillingDocument"("tenantId", "locationId", "idempotencyKey");
CREATE UNIQUE INDEX "BillingDocument_tenantId_providerName_referenceCode_key"
    ON "BillingDocument"("tenantId", "providerName", "referenceCode");
CREATE INDEX "BillingDocument_tenantId_locationId_createdAt_idx"
    ON "BillingDocument"("tenantId", "locationId", "createdAt");
CREATE INDEX "BillingDocument_orderId_idx"
    ON "BillingDocument"("orderId");

ALTER TABLE "BillingDocument"
    ADD CONSTRAINT "BillingDocument_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingDocument"
    ADD CONSTRAINT "BillingDocument_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BillingDocument"
    ADD CONSTRAINT "BillingDocument_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BillingLocationConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "countryCode" VARCHAR(2) NOT NULL DEFAULT 'CO',
    "issuerLegalName" TEXT,
    "issuerTaxId" TEXT,
    "issuerTaxIdDv" TEXT,
    "establishmentName" TEXT,
    "establishmentAddress" TEXT,
    "establishmentMunicipalityCode" TEXT,
    "establishmentPhone" TEXT,
    "establishmentEmail" TEXT,
    "numberingRangeId" INTEGER,
    "factusCredentialsEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingLocationConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BillingLocationConfiguration_tenantId_locationId_key"
    ON "BillingLocationConfiguration"("tenantId", "locationId");
CREATE UNIQUE INDEX "BillingLocationConfiguration_locationId_key"
    ON "BillingLocationConfiguration"("locationId");
CREATE INDEX "BillingLocationConfiguration_tenantId_idx"
    ON "BillingLocationConfiguration"("tenantId");

ALTER TABLE "BillingLocationConfiguration"
    ADD CONSTRAINT "BillingLocationConfiguration_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BillingLocationConfiguration"
    ADD CONSTRAINT "BillingLocationConfiguration_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
