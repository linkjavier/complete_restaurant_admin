/*
  Warnings:

  - Added the required column `updatedAt` to the `WhatsappMessage` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "WhatsappMessage_from_idx";

-- DropIndex
DROP INDEX "WhatsappMessage_locationId_idx";

-- DropIndex
DROP INDEX "WhatsappMessage_timestamp_idx";

-- AlterTable
ALTER TABLE "WhatsappMessage" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "isVoiceNote" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
