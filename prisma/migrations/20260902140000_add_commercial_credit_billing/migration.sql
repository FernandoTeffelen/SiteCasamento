CREATE TYPE "SubscriptionTier" AS ENUM ('STARTER', 'PRO', 'AGENCY');
CREATE TYPE "SubscriptionPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED');
CREATE TYPE "OneTimePurchaseStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED', 'REFUNDED');
CREATE TYPE "CreditLedgerEntryType" AS ENUM ('ONE_TIME_PURCHASE', 'SUBSCRIPTION_CYCLE', 'WEDDING_ACTIVATION', 'REFUND', 'ADJUSTMENT');
CREATE TYPE "CommercialAddOnKind" AS ENUM ('PREMIUM_TEMPLATE', 'WHITE_LABEL', 'ADDITIONAL_SERVICE');
CREATE TYPE "EntitlementStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED');

CREATE TABLE "CreditPackage" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "credits" INTEGER NOT NULL,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tier" "SubscriptionTier" NOT NULL,
  "period" "SubscriptionPeriod" NOT NULL,
  "creditsPerMonth" INTEGER NOT NULL,
  "creditsPerCycle" INTEGER NOT NULL,
  "cycleMonths" INTEGER NOT NULL,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationSubscription" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
  "tier" "SubscriptionTier" NOT NULL,
  "period" "SubscriptionPeriod" NOT NULL,
  "creditsPerCycle" INTEGER NOT NULL,
  "cycleMonths" INTEGER NOT NULL,
  "currentPeriodStart" TIMESTAMP(3),
  "currentPeriodEnd" TIMESTAMP(3),
  "canceledAt" TIMESTAMP(3),
  "providerSubscriptionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationSubscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationCreditBalance" (
  "organizationId" TEXT NOT NULL,
  "balance" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationCreditBalance_pkey" PRIMARY KEY ("organizationId")
);

CREATE TABLE "OneTimePurchase" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "creditPackageId" TEXT NOT NULL,
  "status" "OneTimePurchaseStatus" NOT NULL DEFAULT 'PENDING',
  "credits" INTEGER NOT NULL,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "idempotencyKey" TEXT NOT NULL,
  "providerPaymentId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OneTimePurchase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CreditLedgerEntry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "weddingId" TEXT,
  "subscriptionId" TEXT,
  "purchaseId" TEXT,
  "type" "CreditLedgerEntryType" NOT NULL,
  "delta" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CommercialAddOn" (
  "id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" "CommercialAddOnKind" NOT NULL,
  "templateId" TEXT,
  "priceCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CommercialAddOn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationEntitlement" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "commercialAddOnId" TEXT NOT NULL,
  "status" "EntitlementStatus" NOT NULL DEFAULT 'PENDING',
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreditPackage_slug_key" ON "CreditPackage"("slug");
CREATE INDEX "CreditPackage_active_idx" ON "CreditPackage"("active");
CREATE UNIQUE INDEX "SubscriptionPlan_slug_key" ON "SubscriptionPlan"("slug");
CREATE UNIQUE INDEX "SubscriptionPlan_tier_period_key" ON "SubscriptionPlan"("tier", "period");
CREATE INDEX "SubscriptionPlan_active_tier_idx" ON "SubscriptionPlan"("active", "tier");
CREATE UNIQUE INDEX "OrganizationSubscription_providerSubscriptionId_key" ON "OrganizationSubscription"("providerSubscriptionId");
CREATE INDEX "OrganizationSubscription_organizationId_status_idx" ON "OrganizationSubscription"("organizationId", "status");
CREATE INDEX "OrganizationSubscription_status_currentPeriodEnd_idx" ON "OrganizationSubscription"("status", "currentPeriodEnd");
CREATE UNIQUE INDEX "OneTimePurchase_organizationId_idempotencyKey_key" ON "OneTimePurchase"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "OneTimePurchase_providerPaymentId_key" ON "OneTimePurchase"("providerPaymentId");
CREATE INDEX "OneTimePurchase_organizationId_status_createdAt_idx" ON "OneTimePurchase"("organizationId", "status", "createdAt");
CREATE UNIQUE INDEX "CreditLedgerEntry_purchaseId_key" ON "CreditLedgerEntry"("purchaseId");
CREATE UNIQUE INDEX "CreditLedgerEntry_organizationId_idempotencyKey_key" ON "CreditLedgerEntry"("organizationId", "idempotencyKey");
CREATE UNIQUE INDEX "CreditLedgerEntry_organizationId_weddingId_type_key" ON "CreditLedgerEntry"("organizationId", "weddingId", "type");
CREATE INDEX "CreditLedgerEntry_organizationId_createdAt_idx" ON "CreditLedgerEntry"("organizationId", "createdAt");
CREATE INDEX "CreditLedgerEntry_organizationId_type_createdAt_idx" ON "CreditLedgerEntry"("organizationId", "type", "createdAt");
CREATE UNIQUE INDEX "CommercialAddOn_slug_key" ON "CommercialAddOn"("slug");
CREATE UNIQUE INDEX "CommercialAddOn_templateId_key" ON "CommercialAddOn"("templateId");
CREATE INDEX "CommercialAddOn_kind_active_idx" ON "CommercialAddOn"("kind", "active");
CREATE UNIQUE INDEX "OrganizationEntitlement_organizationId_commercialAddOnId_key" ON "OrganizationEntitlement"("organizationId", "commercialAddOnId");
CREATE INDEX "OrganizationEntitlement_organizationId_status_idx" ON "OrganizationEntitlement"("organizationId", "status");

ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationCreditBalance" ADD CONSTRAINT "OrganizationCreditBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OneTimePurchase" ADD CONSTRAINT "OneTimePurchase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OneTimePurchase" ADD CONSTRAINT "OneTimePurchase_creditPackageId_fkey" FOREIGN KEY ("creditPackageId") REFERENCES "CreditPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OneTimePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CommercialAddOn" ADD CONSTRAINT "CommercialAddOn_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeddingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationEntitlement" ADD CONSTRAINT "OrganizationEntitlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationEntitlement" ADD CONSTRAINT "OrganizationEntitlement_commercialAddOnId_fkey" FOREIGN KEY ("commercialAddOnId") REFERENCES "CommercialAddOn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
