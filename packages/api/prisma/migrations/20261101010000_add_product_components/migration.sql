ALTER TABLE "Product"
ADD COLUMN "isIntermediate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "unit" TEXT NOT NULL DEFAULT 'unidad';

CREATE TABLE "ProductComponent" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductComponent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductComponent_productId_componentId_key"
ON "ProductComponent"("productId", "componentId");

CREATE INDEX "ProductComponent_componentId_idx"
ON "ProductComponent"("componentId");

ALTER TABLE "ProductComponent"
ADD CONSTRAINT "ProductComponent_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductComponent"
ADD CONSTRAINT "ProductComponent_componentId_fkey"
FOREIGN KEY ("componentId") REFERENCES "Product"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
