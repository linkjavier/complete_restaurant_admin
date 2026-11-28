CREATE TABLE "IngredientCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngredientCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxId" TEXT,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupplierIngredient" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "supplierSku" TEXT,
    "unitCost" DOUBLE PRECISION,
    "packaging" TEXT,
    "minimumOrderQuantity" DOUBLE PRECISION,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierIngredient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Ingredient" ADD COLUMN "categoryId" TEXT;
ALTER TABLE "Purchase" ADD COLUMN "supplierId" TEXT;

CREATE UNIQUE INDEX "IngredientCategory_tenantId_name_key" ON "IngredientCategory"("tenantId", "name");
CREATE INDEX "IngredientCategory_tenantId_idx" ON "IngredientCategory"("tenantId");
CREATE UNIQUE INDEX "Supplier_tenantId_name_key" ON "Supplier"("tenantId", "name");
CREATE UNIQUE INDEX "Supplier_tenantId_taxId_key" ON "Supplier"("tenantId", "taxId");
CREATE INDEX "Supplier_tenantId_isActive_name_idx" ON "Supplier"("tenantId", "isActive", "name");
CREATE UNIQUE INDEX "SupplierIngredient_supplierId_ingredientId_key" ON "SupplierIngredient"("supplierId", "ingredientId");
CREATE INDEX "SupplierIngredient_ingredientId_idx" ON "SupplierIngredient"("ingredientId");
CREATE INDEX "Ingredient_categoryId_idx" ON "Ingredient"("categoryId");
CREATE INDEX "Purchase_tenantId_supplierId_purchaseDate_idx" ON "Purchase"("tenantId", "supplierId", "purchaseDate");

INSERT INTO "Supplier" ("id", "tenantId", "name", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "tenantId", MIN(TRIM("supplierName")), true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Purchase"
WHERE TRIM("supplierName") <> ''
GROUP BY "tenantId", LOWER(TRIM("supplierName"))
ON CONFLICT ("tenantId", "name") DO NOTHING;

UPDATE "Purchase" AS purchase
SET "supplierId" = supplier."id"
FROM "Supplier" AS supplier
WHERE purchase."supplierId" IS NULL
  AND purchase."tenantId" = supplier."tenantId"
  AND LOWER(TRIM(purchase."supplierName")) = LOWER(supplier."name")
  AND TRIM(purchase."supplierName") <> '';

ALTER TABLE "IngredientCategory"
    ADD CONSTRAINT "IngredientCategory_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Supplier"
    ADD CONSTRAINT "Supplier_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierIngredient"
    ADD CONSTRAINT "SupplierIngredient_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SupplierIngredient"
    ADD CONSTRAINT "SupplierIngredient_ingredientId_fkey"
    FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Ingredient"
    ADD CONSTRAINT "Ingredient_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "IngredientCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Purchase"
    ADD CONSTRAINT "Purchase_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
