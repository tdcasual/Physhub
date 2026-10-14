-- AlterTable
ALTER TABLE "Question" ADD COLUMN "hasRenderedImage" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Question_hasRenderedImage_idx" ON "Question"("hasRenderedImage");
