-- CreateEnum
CREATE TYPE "WeddingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'UPLOADING', 'UPLOADED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "Wedding" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brideName" TEXT NOT NULL,
    "groomName" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3),
    "status" "WeddingStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "points" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL,
    "maxSubmissions" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEntry" (
    "id" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wedding_publicId_key" ON "Wedding"("publicId");

-- CreateIndex
CREATE INDEX "Wedding_status_eventDate_idx" ON "Wedding"("status", "eventDate");

-- CreateIndex
CREATE UNIQUE INDEX "Guest_token_key" ON "Guest"("token");

-- CreateIndex
CREATE INDEX "Guest_weddingId_score_idx" ON "Guest"("weddingId", "score" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Guest_id_weddingId_key" ON "Guest"("id", "weddingId");

-- CreateIndex
CREATE INDEX "Mission_weddingId_active_displayOrder_idx" ON "Mission"("weddingId", "active", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_id_weddingId_key" ON "Mission"("id", "weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "Mission_weddingId_displayOrder_key" ON "Mission"("weddingId", "displayOrder");

-- CreateIndex
CREATE INDEX "Submission_weddingId_status_idx" ON "Submission"("weddingId", "status");

-- CreateIndex
CREATE INDEX "Submission_guestId_createdAt_idx" ON "Submission"("guestId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_missionId_status_idx" ON "Submission"("missionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_id_weddingId_key" ON "Submission"("id", "weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_guestId_missionId_sequence_key" ON "Submission"("guestId", "missionId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_submissionId_key" ON "Photo"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_storageKey_key" ON "Photo"("storageKey");

-- CreateIndex
CREATE INDEX "Photo_weddingId_createdAt_idx" ON "Photo"("weddingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_submissionId_weddingId_key" ON "Photo"("submissionId", "weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_submissionId_key" ON "ScoreEntry"("submissionId");

-- CreateIndex
CREATE INDEX "ScoreEntry_weddingId_points_idx" ON "ScoreEntry"("weddingId", "points");

-- CreateIndex
CREATE INDEX "ScoreEntry_weddingId_guestId_idx" ON "ScoreEntry"("weddingId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_id_weddingId_key" ON "ScoreEntry"("id", "weddingId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_guestId_missionId_key" ON "ScoreEntry"("guestId", "missionId");

-- CreateIndex
CREATE UNIQUE INDEX "ScoreEntry_submissionId_weddingId_key" ON "ScoreEntry"("submissionId", "weddingId");

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_guestId_weddingId_fkey" FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_missionId_weddingId_fkey" FOREIGN KEY ("missionId", "weddingId") REFERENCES "Mission"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_submissionId_weddingId_fkey" FOREIGN KEY ("submissionId", "weddingId") REFERENCES "Submission"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_weddingId_fkey" FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_guestId_weddingId_fkey" FOREIGN KEY ("guestId", "weddingId") REFERENCES "Guest"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_missionId_weddingId_fkey" FOREIGN KEY ("missionId", "weddingId") REFERENCES "Mission"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_submissionId_weddingId_fkey" FOREIGN KEY ("submissionId", "weddingId") REFERENCES "Submission"("id", "weddingId") ON DELETE CASCADE ON UPDATE CASCADE;
