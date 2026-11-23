-- CreateEnum
CREATE TYPE "WhatsappCloudMessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "WhatsappCloudMessageStatus" AS ENUM ('PENDING', 'RECEIVED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateEnum
CREATE TYPE "WhatsappCloudProcessingStatus" AS ENUM ('PENDING', 'RESPONSE_READY', 'COMPLETED');

-- CreateTable
CREATE TABLE "WhatsappCloudIntegration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "phoneNumberId" TEXT NOT NULL,
    "wabaId" TEXT NOT NULL,
    "accessTokenEncrypted" TEXT NOT NULL,
    "displayPhoneNumber" TEXT,
    "verifiedName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCloudIntegration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappCloudConversation" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "profileName" TEXT,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lastMessageText" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappCloudConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsappCloudMessage" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "providerMessageId" TEXT NOT NULL,
    "direction" "WhatsappCloudMessageDirection" NOT NULL,
    "type" TEXT NOT NULL,
    "body" TEXT,
    "assistantResponse" TEXT,
    "status" "WhatsappCloudMessageStatus" NOT NULL DEFAULT 'RECEIVED',
    "processingStatus" "WhatsappCloudProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "replyToProviderMessageId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "mediaId" TEXT,
    "mimeType" TEXT,
    "isVoiceNote" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsappCloudMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudIntegration_locationId_key" ON "WhatsappCloudIntegration"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudIntegration_phoneNumberId_key" ON "WhatsappCloudIntegration"("phoneNumberId");

-- CreateIndex
CREATE INDEX "WhatsappCloudIntegration_tenantId_idx" ON "WhatsappCloudIntegration"("tenantId");

-- CreateIndex
CREATE INDEX "WhatsappCloudConversation_tenantId_locationId_lastMessageAt_idx" ON "WhatsappCloudConversation"("tenantId", "locationId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudConversation_integrationId_contactId_key" ON "WhatsappCloudConversation"("integrationId", "contactId");

-- CreateIndex
CREATE INDEX "WhatsappCloudMessage_conversationId_timestamp_idx" ON "WhatsappCloudMessage"("conversationId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudMessage_integrationId_providerMessageId_key" ON "WhatsappCloudMessage"("integrationId", "providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappCloudMessage_integrationId_replyToProviderMessageId_key" ON "WhatsappCloudMessage"("integrationId", "replyToProviderMessageId");

-- AddForeignKey
ALTER TABLE "WhatsappCloudIntegration" ADD CONSTRAINT "WhatsappCloudIntegration_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCloudIntegration" ADD CONSTRAINT "WhatsappCloudIntegration_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCloudConversation" ADD CONSTRAINT "WhatsappCloudConversation_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "WhatsappCloudIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCloudConversation" ADD CONSTRAINT "WhatsappCloudConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCloudConversation" ADD CONSTRAINT "WhatsappCloudConversation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCloudMessage" ADD CONSTRAINT "WhatsappCloudMessage_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "WhatsappCloudIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsappCloudMessage" ADD CONSTRAINT "WhatsappCloudMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsappCloudConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
