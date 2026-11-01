CREATE TABLE "OAuthLoginTicket" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthLoginTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthLoginTicket_codeHash_key" ON "OAuthLoginTicket"("codeHash");
CREATE INDEX "OAuthLoginTicket_userId_idx" ON "OAuthLoginTicket"("userId");
CREATE INDEX "OAuthLoginTicket_expiresAt_idx" ON "OAuthLoginTicket"("expiresAt");

ALTER TABLE "OAuthLoginTicket"
    ADD CONSTRAINT "OAuthLoginTicket_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
