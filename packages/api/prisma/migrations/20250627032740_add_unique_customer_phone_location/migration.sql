/*
  Warnings:

  - A unique constraint covering the columns `[phone,locationId]` on the table `Customer` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_locationId_key" ON "Customer"("phone", "locationId");
