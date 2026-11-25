ALTER TABLE "TableShift"
ADD COLUMN "openingCash" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "closingDeclared" JSONB,
ADD COLUMN "closingExpected" JSONB,
ADD COLUMN "closingVariance" JSONB,
ADD COLUMN "closingNote" TEXT;

ALTER TABLE "Settings"
ADD COLUMN "defaultOpeningCash" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "Payment"
ADD COLUMN "shiftId" TEXT;

CREATE INDEX "Payment_shiftId_status_idx"
ON "Payment"("shiftId", "status");

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_shiftId_fkey"
FOREIGN KEY ("shiftId") REFERENCES "TableShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
