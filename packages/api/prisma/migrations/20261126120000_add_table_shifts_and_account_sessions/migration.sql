CREATE TABLE "TableShift" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "openedById" TEXT,
    "closedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "TableShift_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TableAccountSession" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "shiftId" TEXT,
    "closedById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "orderCount" INTEGER NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "TableAccountSession_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Order"
ADD COLUMN "tableAccountSessionId" TEXT;

CREATE UNIQUE INDEX "TableShift_one_active_per_location_idx"
ON "TableShift"("locationId")
WHERE "endedAt" IS NULL;

CREATE INDEX "TableShift_tenantId_locationId_startedAt_idx"
ON "TableShift"("tenantId", "locationId", "startedAt");

CREATE INDEX "TableAccountSession_tableId_startedAt_idx"
ON "TableAccountSession"("tableId", "startedAt");

CREATE INDEX "TableAccountSession_tenantId_locationId_shiftId_idx"
ON "TableAccountSession"("tenantId", "locationId", "shiftId");

CREATE INDEX "Order_tableAccountSessionId_idx"
ON "Order"("tableAccountSessionId");

ALTER TABLE "TableShift"
ADD CONSTRAINT "TableShift_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableShift"
ADD CONSTRAINT "TableShift_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableShift"
ADD CONSTRAINT "TableShift_openedById_fkey"
FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableShift"
ADD CONSTRAINT "TableShift_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableAccountSession"
ADD CONSTRAINT "TableAccountSession_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableAccountSession"
ADD CONSTRAINT "TableAccountSession_locationId_fkey"
FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableAccountSession"
ADD CONSTRAINT "TableAccountSession_tableId_fkey"
FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TableAccountSession"
ADD CONSTRAINT "TableAccountSession_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "TableShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TableAccountSession"
ADD CONSTRAINT "TableAccountSession_closedById_fkey"
FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Order"
ADD CONSTRAINT "Order_tableAccountSessionId_fkey"
FOREIGN KEY ("tableAccountSessionId") REFERENCES "TableAccountSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
