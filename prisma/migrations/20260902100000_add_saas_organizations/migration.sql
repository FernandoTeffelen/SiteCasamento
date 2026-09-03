-- Organizations and their administrative users are intentionally separate from
-- public wedding guests. Existing event data is assigned to one legacy
-- organization so this migration is safe for databases that already have data.
CREATE TYPE "OrganizationRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_publicId_key" ON "Organization"("publicId");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_userId_key" ON "OrganizationMembership"("organizationId", "userId");
CREATE INDEX "OrganizationMembership_userId_organizationId_idx" ON "OrganizationMembership"("userId", "organizationId");

INSERT INTO "Organization" ("id", "publicId", "name", "updatedAt")
VALUES ('org_legacy_import', 'org_legacy_import', 'Eventos importados', CURRENT_TIMESTAMP);

ALTER TABLE "Wedding" ADD COLUMN "organizationId" TEXT;
UPDATE "Wedding" SET "organizationId" = 'org_legacy_import' WHERE "organizationId" IS NULL;
ALTER TABLE "Wedding" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Guest" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Mission" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Submission" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Photo" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ScoreEntry" ADD COLUMN "organizationId" TEXT;

UPDATE "Guest" AS child SET "organizationId" = wedding."organizationId" FROM "Wedding" AS wedding WHERE child."weddingId" = wedding."id";
UPDATE "Mission" AS child SET "organizationId" = wedding."organizationId" FROM "Wedding" AS wedding WHERE child."weddingId" = wedding."id";
UPDATE "Submission" AS child SET "organizationId" = wedding."organizationId" FROM "Wedding" AS wedding WHERE child."weddingId" = wedding."id";
UPDATE "Photo" AS child SET "organizationId" = wedding."organizationId" FROM "Wedding" AS wedding WHERE child."weddingId" = wedding."id";
UPDATE "ScoreEntry" AS child SET "organizationId" = wedding."organizationId" FROM "Wedding" AS wedding WHERE child."weddingId" = wedding."id";

ALTER TABLE "Guest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Mission" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Submission" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Photo" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ScoreEntry" ALTER COLUMN "organizationId" SET NOT NULL;

ALTER TABLE "Guest" DROP CONSTRAINT "Guest_weddingId_fkey";
ALTER TABLE "Mission" DROP CONSTRAINT "Mission_weddingId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_weddingId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_guestId_weddingId_fkey";
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_missionId_weddingId_fkey";
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_weddingId_fkey";
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_submissionId_weddingId_fkey";
ALTER TABLE "ScoreEntry" DROP CONSTRAINT "ScoreEntry_weddingId_fkey";
ALTER TABLE "ScoreEntry" DROP CONSTRAINT "ScoreEntry_guestId_weddingId_fkey";
ALTER TABLE "ScoreEntry" DROP CONSTRAINT "ScoreEntry_missionId_weddingId_fkey";
ALTER TABLE "ScoreEntry" DROP CONSTRAINT "ScoreEntry_submissionId_weddingId_fkey";

DROP INDEX "Wedding_status_eventDate_idx";
DROP INDEX "Guest_id_weddingId_key";
DROP INDEX "Guest_weddingId_score_idx";
DROP INDEX "Mission_id_weddingId_key";
DROP INDEX "Mission_weddingId_displayOrder_key";
DROP INDEX "Mission_weddingId_active_displayOrder_idx";
DROP INDEX "Submission_id_weddingId_key";
DROP INDEX "Submission_weddingId_clientUploadId_key";
DROP INDEX "Submission_weddingId_clientUploadId_idx";
DROP INDEX "Submission_weddingId_status_idx";
DROP INDEX "Submission_guestId_createdAt_idx";
DROP INDEX "Submission_missionId_status_idx";
DROP INDEX "Photo_submissionId_weddingId_key";
DROP INDEX "Photo_weddingId_createdAt_idx";
DROP INDEX "ScoreEntry_id_weddingId_key";
DROP INDEX "ScoreEntry_submissionId_weddingId_key";
DROP INDEX "ScoreEntry_weddingId_points_idx";
DROP INDEX "ScoreEntry_weddingId_guestId_idx";

CREATE UNIQUE INDEX "Wedding_id_organizationId_key" ON "Wedding"("id", "organizationId");
CREATE INDEX "Wedding_organizationId_status_eventDate_idx" ON "Wedding"("organizationId", "status", "eventDate");
CREATE UNIQUE INDEX "Guest_id_weddingId_organizationId_key" ON "Guest"("id", "weddingId", "organizationId");
CREATE INDEX "Guest_organizationId_weddingId_score_idx" ON "Guest"("organizationId", "weddingId", "score" DESC);
CREATE UNIQUE INDEX "Mission_id_weddingId_organizationId_key" ON "Mission"("id", "weddingId", "organizationId");
CREATE UNIQUE INDEX "Mission_organizationId_weddingId_displayOrder_key" ON "Mission"("organizationId", "weddingId", "displayOrder");
CREATE INDEX "Mission_organizationId_weddingId_active_displayOrder_idx" ON "Mission"("organizationId", "weddingId", "active", "displayOrder");
CREATE UNIQUE INDEX "Submission_id_weddingId_organizationId_key" ON "Submission"("id", "weddingId", "organizationId");
CREATE UNIQUE INDEX "Submission_organizationId_weddingId_clientUploadId_key" ON "Submission"("organizationId", "weddingId", "clientUploadId");
CREATE INDEX "Submission_organizationId_weddingId_clientUploadId_idx" ON "Submission"("organizationId", "weddingId", "clientUploadId");
CREATE INDEX "Submission_organizationId_weddingId_status_idx" ON "Submission"("organizationId", "weddingId", "status");
CREATE INDEX "Submission_organizationId_guestId_createdAt_idx" ON "Submission"("organizationId", "guestId", "createdAt");
CREATE INDEX "Submission_organizationId_missionId_status_idx" ON "Submission"("organizationId", "missionId", "status");
CREATE UNIQUE INDEX "Photo_submissionId_weddingId_organizationId_key" ON "Photo"("submissionId", "weddingId", "organizationId");
CREATE INDEX "Photo_organizationId_weddingId_createdAt_idx" ON "Photo"("organizationId", "weddingId", "createdAt");
CREATE UNIQUE INDEX "ScoreEntry_id_weddingId_organizationId_key" ON "ScoreEntry"("id", "weddingId", "organizationId");
CREATE UNIQUE INDEX "ScoreEntry_submissionId_weddingId_organizationId_key" ON "ScoreEntry"("submissionId", "weddingId", "organizationId");
CREATE INDEX "ScoreEntry_organizationId_weddingId_points_idx" ON "ScoreEntry"("organizationId", "weddingId", "points");
CREATE INDEX "ScoreEntry_organizationId_weddingId_guestId_idx" ON "ScoreEntry"("organizationId", "weddingId", "guestId");

ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_guestId_weddingId_organizationId_fkey" FOREIGN KEY ("guestId", "weddingId", "organizationId") REFERENCES "Guest"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_missionId_weddingId_organizationId_fkey" FOREIGN KEY ("missionId", "weddingId", "organizationId") REFERENCES "Mission"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_submissionId_weddingId_organizationId_fkey" FOREIGN KEY ("submissionId", "weddingId", "organizationId") REFERENCES "Submission"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_guestId_weddingId_organizationId_fkey" FOREIGN KEY ("guestId", "weddingId", "organizationId") REFERENCES "Guest"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_missionId_weddingId_organizationId_fkey" FOREIGN KEY ("missionId", "weddingId", "organizationId") REFERENCES "Mission"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScoreEntry" ADD CONSTRAINT "ScoreEntry_submissionId_weddingId_organizationId_fkey" FOREIGN KEY ("submissionId", "weddingId", "organizationId") REFERENCES "Submission"("id", "weddingId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
