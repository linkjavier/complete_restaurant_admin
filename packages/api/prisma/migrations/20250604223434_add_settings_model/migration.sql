-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "aiName" TEXT NOT NULL DEFAULT 'Sandra',
    "aiGender" TEXT NOT NULL DEFAULT 'female',
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
