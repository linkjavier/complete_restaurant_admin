-- DropForeignKey
ALTER TABLE "Ingredient" DROP CONSTRAINT "Ingredient_locationId_fkey";

-- CreateIndex
CREATE INDEX "Ingredient_locationId_idx" ON "Ingredient"("locationId");

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
