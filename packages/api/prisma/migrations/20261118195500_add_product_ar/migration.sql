ALTER TABLE "Product"
ADD COLUMN "arEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "model3dUrl" TEXT,
ADD COLUMN "modelUsdzUrl" TEXT,
ADD COLUMN "modelThumbnailUrl" TEXT,
ADD COLUMN "modelScale" JSONB,
ADD COLUMN "arPlacement" TEXT NOT NULL DEFAULT 'floor',
ADD COLUMN "modelFileSize" INTEGER;
