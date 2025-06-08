-- AlterTable
ALTER TABLE "WhatsappMessage" ADD COLUMN     "isFromAI" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "WhatsappMessage_from_idx" ON "WhatsappMessage"("from");
