CREATE TYPE "UserAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "UserAccessRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "avatar" TEXT,
    "passwordHash" TEXT,
    "status" "UserAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "UserAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserAccessRequest_tenantId_email_key" ON "UserAccessRequest"("tenantId", "email");
CREATE INDEX "UserAccessRequest_tenantId_status_requestedAt_idx" ON "UserAccessRequest"("tenantId", "status", "requestedAt");
CREATE INDEX "UserAccessRequest_reviewedById_idx" ON "UserAccessRequest"("reviewedById");

ALTER TABLE "UserAccessRequest"
    ADD CONSTRAINT "UserAccessRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserAccessRequest"
    ADD CONSTRAINT "UserAccessRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
