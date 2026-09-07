ALTER TABLE "ManualAccessPlan"
  ADD COLUMN "lastCreditReleasedAt" TIMESTAMP(3),
  ADD COLUMN "nextCreditReleaseAt" TIMESTAMP(3);

CREATE INDEX "ManualAccessPlan_organizationId_status_nextCreditReleaseAt_idx"
  ON "ManualAccessPlan"("organizationId", "status", "nextCreditReleaseAt");
