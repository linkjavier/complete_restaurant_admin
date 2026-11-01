ALTER TABLE "ProductionLog"
    ADD COLUMN "number" SERIAL NOT NULL,
    ADD COLUMN "productCode" TEXT,
    ADD COLUMN "productName" TEXT,
    ADD COLUMN "productUnit" TEXT,
    ADD COLUMN "createdById" TEXT,
    ADD COLUMN "consumedMaterials" JSONB NOT NULL DEFAULT '[]';

UPDATE "ProductionLog" AS log
SET
    "productCode" = product."code",
    "productName" = product."name",
    "productUnit" = product."unit"
FROM "Product" AS product
WHERE log."productId" = product."id";

CREATE UNIQUE INDEX "ProductionLog_number_key" ON "ProductionLog"("number");
CREATE INDEX "ProductionLog_productId_createdAt_idx" ON "ProductionLog"("productId", "createdAt");
CREATE INDEX "ProductionLog_createdById_idx" ON "ProductionLog"("createdById");

ALTER TABLE "ProductionLog"
    ADD CONSTRAINT "ProductionLog_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
