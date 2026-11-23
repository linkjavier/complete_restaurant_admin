-- AlterTable
ALTER TABLE "ProductionLog" ADD COLUMN     "wasteQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "wasteNotes" TEXT;
