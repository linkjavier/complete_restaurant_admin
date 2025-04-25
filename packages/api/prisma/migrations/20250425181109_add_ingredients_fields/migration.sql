/*
  Warnings:

  - Added the required column `locationId` to the `Ingredient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `minQuantity` to the `Ingredient` table without a default value. This is not possible if the table is not empty.
  - Added the required column `quantity` to the `Ingredient` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN     "description" TEXT,
ADD COLUMN     "locationId" TEXT NOT NULL,
ADD COLUMN     "minQuantity" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "quantity" DOUBLE PRECISION NOT NULL;

-- AddForeignKey
ALTER TABLE "Ingredient" ADD CONSTRAINT "Ingredient_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
