CREATE TYPE "CustomerType" AS ENUM ('CEREMONIALIST', 'COUPLE');
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

ALTER TABLE "User"
  ADD COLUMN "customerType" "CustomerType" NOT NULL DEFAULT 'CEREMONIALIST',
  ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';

CREATE INDEX "User_platformRole_accountStatus_createdAt_idx"
  ON "User"("platformRole", "accountStatus", "createdAt" DESC);
