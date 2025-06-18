/*
  Warnings:

  - Added the required column `source` to the `Order` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('POS', 'QR', 'WHATSAPP');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "source" "OrderSource" NOT NULL;
