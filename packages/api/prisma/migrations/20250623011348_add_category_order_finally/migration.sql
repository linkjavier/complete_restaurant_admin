-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Settings" ALTER COLUMN "businessName" SET DEFAULT 'Kutchen AI';

-- AlterTable
ALTER TABLE "locations" ADD COLUMN     "order" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Category_order_idx" ON "Category"("order");

-- CreateIndex
CREATE INDEX "locations_order_idx" ON "locations"("order");
