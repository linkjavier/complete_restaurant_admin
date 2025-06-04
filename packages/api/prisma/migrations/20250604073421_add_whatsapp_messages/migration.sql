-- CreateTable
CREATE TABLE "WhatsappMessage" (
    "id" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsappMessage_locationId_idx" ON "WhatsappMessage"("locationId");

-- CreateIndex
CREATE INDEX "WhatsappMessage_timestamp_idx" ON "WhatsappMessage"("timestamp");

-- AddForeignKey
ALTER TABLE "WhatsappMessage" ADD CONSTRAINT "WhatsappMessage_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
