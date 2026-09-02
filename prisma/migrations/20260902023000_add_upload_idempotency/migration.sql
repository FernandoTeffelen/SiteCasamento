-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "clientUploadId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_weddingId_clientUploadId_key"
ON "Submission"("weddingId", "clientUploadId");

-- CreateIndex
CREATE INDEX "Submission_weddingId_clientUploadId_idx"
ON "Submission"("weddingId", "clientUploadId");
