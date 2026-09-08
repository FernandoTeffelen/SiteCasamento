-- Garantias que não podem depender somente da validação da aplicação.
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_name_not_blank" CHECK (btrim("name") <> '');

ALTER TABLE "User"
  ADD CONSTRAINT "User_email_not_blank" CHECK (btrim("email") <> '');

-- A aplicação normaliza e-mails; este índice também protege gravações diretas
-- e diferenças de maiúsculas/minúsculas no PostgreSQL.
CREATE UNIQUE INDEX "User_email_lower_key" ON "User" (lower("email"));

ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_name_not_blank" CHECK (btrim("name") <> ''),
  ADD CONSTRAINT "Wedding_brideName_not_blank" CHECK (btrim("brideName") <> ''),
  ADD CONSTRAINT "Wedding_groomName_not_blank" CHECK (btrim("groomName") <> '');

ALTER TABLE "ManualAccessPlan"
  ADD CONSTRAINT "ManualAccessPlan_durationMonths_positive" CHECK ("durationMonths" > 0),
  ADD CONSTRAINT "ManualAccessPlan_creditsPerMonth_positive" CHECK ("creditsPerMonth" > 0),
  ADD CONSTRAINT "ManualAccessPlan_date_range_valid" CHECK ("endDate" > "startDate"),
  ADD CONSTRAINT "ManualAccessPlan_canceledAt_consistent" CHECK (
    ("status" = 'CANCELED' AND "canceledAt" IS NOT NULL)
    OR ("status" <> 'CANCELED' AND "canceledAt" IS NULL)
  );

ALTER TABLE "Guest"
  ADD CONSTRAINT "Guest_age_valid" CHECK ("age" IS NULL OR ("age" >= 0 AND "age" <= 130)),
  ADD CONSTRAINT "Guest_score_non_negative" CHECK ("score" >= 0);

ALTER TABLE "Mission"
  ADD CONSTRAINT "Mission_points_non_negative" CHECK ("points" >= 0),
  ADD CONSTRAINT "Mission_displayOrder_non_negative" CHECK ("displayOrder" >= 0),
  ADD CONSTRAINT "Mission_maxSubmissions_positive" CHECK ("maxSubmissions" IS NULL OR "maxSubmissions" > 0);

ALTER TABLE "Submission"
  ADD CONSTRAINT "Submission_sequence_positive" CHECK ("sequence" > 0),
  ADD CONSTRAINT "Submission_scoreAwarded_non_negative" CHECK ("scoreAwarded" >= 0);

ALTER TABLE "Photo"
  ADD CONSTRAINT "Photo_contentType_not_blank" CHECK (btrim("contentType") <> ''),
  ADD CONSTRAINT "Photo_sizeBytes_positive" CHECK ("sizeBytes" > 0);

ALTER TABLE "ScoreEntry"
  ADD CONSTRAINT "ScoreEntry_points_non_negative" CHECK ("points" >= 0);

CREATE TYPE "AdminAuditAction" AS ENUM (
  'CUSTOMER_STATUS_CHANGED',
  'CUSTOMER_DELETED',
  'CREDIT_ADJUSTED',
  'MANUAL_PLAN_CREATED',
  'MANUAL_PLAN_UPDATED',
  'MANUAL_PLAN_STATUS_CHANGED'
);

CREATE TABLE "AdminAuditLog" (
  "id" TEXT NOT NULL,
  "action" "AdminAuditAction" NOT NULL,
  "actorUserId" TEXT,
  "customerId" TEXT,
  "organizationId" TEXT,
  "weddingId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminAuditLog_createdAt_idx"
  ON "AdminAuditLog"("createdAt" DESC);
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx"
  ON "AdminAuditLog"("actorUserId", "createdAt" DESC);
CREATE INDEX "AdminAuditLog_customerId_createdAt_idx"
  ON "AdminAuditLog"("customerId", "createdAt" DESC);
CREATE INDEX "AdminAuditLog_organizationId_createdAt_idx"
  ON "AdminAuditLog"("organizationId", "createdAt" DESC);
CREATE INDEX "AdminAuditLog_weddingId_createdAt_idx"
  ON "AdminAuditLog"("weddingId", "createdAt" DESC);

ALTER TABLE "AdminAuditLog"
  ADD CONSTRAINT "AdminAuditLog_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AdminAuditLog_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AdminAuditLog_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AdminAuditLog_weddingId_fkey"
    FOREIGN KEY ("weddingId") REFERENCES "Wedding"("id") ON DELETE SET NULL ON UPDATE CASCADE;
