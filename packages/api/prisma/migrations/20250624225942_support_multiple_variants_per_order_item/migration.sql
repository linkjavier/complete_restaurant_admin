/*
  Warnings:

  - You are about to drop the column `productVariantId` on the `OrderItem` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productVariantId_fkey";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN "productVariantId";

-- CreateTable
CREATE TABLE "OrderItemVariant" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productVariantId" TEXT NOT NULL,
    "groupName" TEXT,

    CONSTRAINT "OrderItemVariant_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OrderItemVariant" ADD CONSTRAINT "OrderItemVariant_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemVariant" ADD CONSTRAINT "OrderItemVariant_productVariantId_fkey" FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
