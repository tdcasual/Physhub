-- AlterTable
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "User" ADD COLUMN "disabledAt" TIMESTAMP(3);

UPDATE "User" SET "username" = 'owner' WHERE "email" = 'owner@example.com' AND "username" IS NULL;
UPDATE "User" SET "username" = "id" WHERE "username" IS NULL;

ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateTable
CREATE TABLE "EditorSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EditorSession_tokenHash_key" ON "EditorSession"("tokenHash");
CREATE INDEX "EditorSession_userId_idx" ON "EditorSession"("userId");

ALTER TABLE "EditorSession" ADD CONSTRAINT "EditorSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
