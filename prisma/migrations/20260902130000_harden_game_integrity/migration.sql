-- A guest token remains the credential for the public flow. E-mail distinguishes
-- guests with the same name inside one wedding but is never used as a login.
ALTER TABLE "Guest" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "Guest_organizationId_weddingId_email_key"
  ON "Guest"("organizationId", "weddingId", "email");

CREATE TYPE "PhotoModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "ScoreEntrySource" AS ENUM ('MISSION_COMPLETION', 'ADMIN_ADJUSTMENT');

-- Keep Photo denormalized enough for efficient galleries/moderation while
-- copying the immutable ownership already present in its Submission.
ALTER TABLE "Photo"
  ADD COLUMN "guestId" TEXT,
  ADD COLUMN "missionId" TEXT,
  ADD COLUMN "moderationStatus" "PhotoModerationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "moderationNote" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3),
  ADD COLUMN "moderatedByUserId" TEXT;

UPDATE "Photo" AS photo
SET "guestId" = submission."guestId",
    "missionId" = submission."missionId"
FROM "Submission" AS submission
WHERE photo."submissionId" = submission."id"
  AND photo."weddingId" = submission."weddingId"
  AND photo."organizationId" = submission."organizationId";

ALTER TABLE "Photo" ALTER COLUMN "guestId" SET NOT NULL;
ALTER TABLE "Photo" ALTER COLUMN "missionId" SET NOT NULL;

ALTER TABLE "ScoreEntry"
  ADD COLUMN "source" "ScoreEntrySource" NOT NULL DEFAULT 'MISSION_COMPLETION',
  ADD COLUMN "reason" TEXT;

-- A single composite identity lets Photo and ScoreEntry reference the exact
-- guest/mission pair of their Submission, preventing cross-wedding joins even
-- if an internal id is accidentally supplied from another event.
CREATE UNIQUE INDEX "Submission_id_weddingId_organizationId_guestId_missionId_key"
  ON "Submission"("id", "weddingId", "organizationId", "guestId", "missionId");
CREATE UNIQUE INDEX "Photo_submissionId_weddingId_organizationId_guestId_missionId_key"
  ON "Photo"("submissionId", "weddingId", "organizationId", "guestId", "missionId");
CREATE UNIQUE INDEX "ScoreEntry_submissionId_weddingId_organizationId_guestId_missionId_key"
  ON "ScoreEntry"("submissionId", "weddingId", "organizationId", "guestId", "missionId");

ALTER TABLE "Photo" DROP CONSTRAINT "Photo_submissionId_weddingId_organizationId_fkey";
ALTER TABLE "ScoreEntry" DROP CONSTRAINT "ScoreEntry_submissionId_weddingId_organizationId_fkey";

ALTER TABLE "Photo" ADD CONSTRAINT "Photo_guestId_weddingId_organizationId_fkey"
  FOREIGN KEY ("guestId", "weddingId", "organizationId")
  REFERENCES "Guest"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_missionId_weddingId_organizationId_fkey"
  FOREIGN KEY ("missionId", "weddingId", "organizationId")
  REFERENCES "Mission"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_submissionId_weddingId_organizationId_guestId_missionId_fkey"
  FOREIGN KEY ("submissionId", "weddingId", "organizationId", "guestId", "missionId")
  REFERENCES "Submission"("id", "weddingId", "organizationId", "guestId", "missionId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_moderatedByUserId_fkey"
  FOREIGN KEY ("moderatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_submissionId_weddingId_organizationId_guestId_missionId_fkey"
  FOREIGN KEY ("submissionId", "weddingId", "organizationId", "guestId", "missionId")
  REFERENCES "Submission"("id", "weddingId", "organizationId", "guestId", "missionId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Photo_organizationId_weddingId_moderationStatus_createdAt_idx"
  ON "Photo"("organizationId", "weddingId", "moderationStatus", "createdAt");
CREATE INDEX "Photo_organizationId_weddingId_guestId_missionId_idx"
  ON "Photo"("organizationId", "weddingId", "guestId", "missionId");
