/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,locationId]` on the table `Settings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `locationId` to the `Settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tenantId` to the `Settings` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Customer_locationId_idx";

-- DropIndex
DROP INDEX "Customer_phone_idx";

-- DropIndex
DROP INDEX "Customer_phone_locationId_tenantId_key";

-- DropIndex
DROP INDEX "Customer_tenantId_phone_key";

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "locationId" TEXT NOT NULL,
ADD COLUMN     "tenantId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Settings_tenantId_idx" ON "Settings"("tenantId");

-- CreateIndex
CREATE INDEX "Settings_locationId_idx" ON "Settings"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_tenantId_locationId_key" ON "Settings"("tenantId", "locationId");

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
