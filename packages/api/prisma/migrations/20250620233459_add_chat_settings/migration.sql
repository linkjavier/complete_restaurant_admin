-- CreateTable
CREATE TABLE "ChatSettings" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT true,
    "locationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSettings_chatId_locationId_key" ON "ChatSettings"("chatId", "locationId");

-- AddForeignKey
ALTER TABLE "ChatSettings" ADD CONSTRAINT "ChatSettings_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
