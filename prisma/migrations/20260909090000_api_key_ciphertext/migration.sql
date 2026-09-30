-- AlterTable
ALTER TABLE "ApiKey" ADD COLUMN "keyPrefix" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ApiKey" ADD COLUMN "keyCiphertext" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "createdById" TEXT;

CREATE INDEX "ApiKey_createdById_idx" ON "ApiKey"("createdById");

ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
