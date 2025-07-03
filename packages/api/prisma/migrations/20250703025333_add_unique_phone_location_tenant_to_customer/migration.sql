/*
  Warnings:

  - A unique constraint covering the columns `[phone,locationId,tenantId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_locationId_tenantId_key" ON "Customer"("phone", "locationId", "tenantId");
