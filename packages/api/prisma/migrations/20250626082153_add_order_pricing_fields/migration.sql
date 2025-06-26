-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "subtotal" DOUBLE PRECISION,
ADD COLUMN     "total" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "price" DOUBLE PRECISION;
