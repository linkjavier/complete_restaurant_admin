/*
  Warnings:

  - You are about to drop the `DeliveryDetails` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "DeliveryDetails" DROP CONSTRAINT "DeliveryDetails_orderId_fkey";

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryAddress" TEXT,
ADD COLUMN     "neighborhood" TEXT,
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "phone" TEXT;

-- DropTable
DROP TABLE "DeliveryDetails";
