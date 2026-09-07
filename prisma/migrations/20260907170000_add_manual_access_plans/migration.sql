CREATE TYPE "ManualAccessPlanStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED', 'CANCELED');

CREATE TABLE "ManualAccessPlan" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "createdByUserId" TEXT,
  "status" "ManualAccessPlanStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "durationMonths" INTEGER NOT NULL,
  "creditsPerMonth" INTEGER NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "canceledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ManualAccessPlan_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualAccessPlan_organizationId_status_endDate_idx"
  ON "ManualAccessPlan"("organizationId", "status", "endDate");
CREATE INDEX "ManualAccessPlan_customerId_createdAt_idx"
  ON "ManualAccessPlan"("customerId", "createdAt" DESC);

ALTER TABLE "ManualAccessPlan" ADD CONSTRAINT "ManualAccessPlan_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualAccessPlan" ADD CONSTRAINT "ManualAccessPlan_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualAccessPlan" ADD CONSTRAINT "ManualAccessPlan_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
