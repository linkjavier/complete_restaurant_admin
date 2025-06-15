-- CreateIndex
CREATE INDEX "WhatsappMessage_locationId_idx" ON "WhatsappMessage"("locationId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_from_idx" ON "WhatsappMessage"("from");

-- CreateIndex
CREATE INDEX "WhatsappMessage_timestamp_idx" ON "WhatsappMessage"("timestamp");
