ALTER TABLE "Settings"
ADD COLUMN "qrMenuEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qrMenuOrderingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "qrMenuPrimaryColor" TEXT NOT NULL DEFAULT '#c2410c',
ADD COLUMN "qrMenuWhatsAppPhone" TEXT,
ADD COLUMN "qrMenuProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "qrMenuProductsConfigured" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "QrMenuBanner" (
    "id" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QrMenuBanner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "QrMenuBanner_settingsId_order_idx" ON "QrMenuBanner"("settingsId", "order");

ALTER TABLE "QrMenuBanner"
ADD CONSTRAINT "QrMenuBanner_settingsId_fkey"
FOREIGN KEY ("settingsId") REFERENCES "Settings"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
