-- AlterEnum
ALTER TYPE "OrderType" ADD VALUE 'DELIVERY';

-- CreateTable
CREATE TABLE "DeliveryDetails" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "neighborhood" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryDetails_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDetails_orderId_key" ON "DeliveryDetails"("orderId");

-- AddForeignKey
ALTER TABLE "DeliveryDetails" ADD CONSTRAINT "DeliveryDetails_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
