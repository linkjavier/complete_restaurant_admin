CREATE TYPE "InventoryModificationStatus" AS ENUM ('DRAFT', 'APPLIED');

CREATE TYPE "InventoryModificationItemType" AS ENUM ('PRODUCT', 'INGREDIENT');

CREATE TABLE "InventoryModification" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "appliedById" TEXT,
    "status" "InventoryModificationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryModification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InventoryModificationItem" (
    "id" TEXT NOT NULL,
    "modificationId" TEXT NOT NULL,
    "itemType" "InventoryModificationItemType" NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "countedById" TEXT NOT NULL,
    "systemQuantity" DOUBLE PRECISION NOT NULL,
    "countedQuantity" DOUBLE PRECISION NOT NULL,
    "difference" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryModificationItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InventoryModification_number_key" ON "InventoryModification"("number");
CREATE INDEX "InventoryModification_tenantId_locationId_createdAt_idx" ON "InventoryModification"("tenantId", "locationId", "createdAt");
CREATE INDEX "InventoryModification_createdById_idx" ON "InventoryModification"("createdById");
CREATE UNIQUE INDEX "InventoryModificationItem_modificationId_itemType_itemId_key" ON "InventoryModificationItem"("modificationId", "itemType", "itemId");
CREATE INDEX "InventoryModificationItem_itemId_itemType_idx" ON "InventoryModificationItem"("itemId", "itemType");

ALTER TABLE "InventoryModification" ADD CONSTRAINT "InventoryModification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryModification" ADD CONSTRAINT "InventoryModification_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryModification" ADD CONSTRAINT "InventoryModification_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InventoryModification" ADD CONSTRAINT "InventoryModification_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryModificationItem" ADD CONSTRAINT "InventoryModificationItem_modificationId_fkey" FOREIGN KEY ("modificationId") REFERENCES "InventoryModification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryModificationItem" ADD CONSTRAINT "InventoryModificationItem_countedById_fkey" FOREIGN KEY ("countedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
