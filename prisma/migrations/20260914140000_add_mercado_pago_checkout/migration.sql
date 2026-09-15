-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('MERCADO_PAGO');

-- CreateEnum
CREATE TYPE "PaymentProductType" AS ENUM ('SUBSCRIPTION_PLAN', 'CREDIT_PACKAGE', 'CREDIT_VOLUME');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('CREATED', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'REFUNDED', 'ERROR');

-- AlterTable
ALTER TABLE "OneTimePurchase"
  ALTER COLUMN "creditPackageId" DROP NOT NULL,
  ADD COLUMN "creditVolumeTierId" TEXT;

ALTER TABLE "OneTimePurchase"
  ADD CONSTRAINT "OneTimePurchase_product_check"
  CHECK (num_nonnulls("creditPackageId", "creditVolumeTierId") = 1);

ALTER TABLE "OneTimePurchase"
  ADD CONSTRAINT "OneTimePurchase_creditVolumeTierId_fkey"
  FOREIGN KEY ("creditVolumeTierId") REFERENCES "CreditVolumeTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "PaymentAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "purchaseId" TEXT,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
  "productType" "PaymentProductType" NOT NULL,
  "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'CREATED',
  "credits" INTEGER NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "externalReference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "providerPreferenceId" TEXT,
  "providerPaymentId" TEXT,
  "providerStatus" TEXT,
  "checkoutUrl" TEXT,
  "processedAt" TIMESTAMP(3),
  "lastWebhookAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentAttempt_priceCents_check" CHECK ("priceCents" > 0),
  CONSTRAINT "PaymentAttempt_credits_check" CHECK ("credits" > 0),
  CONSTRAINT "PaymentAttempt_product_check" CHECK (
    ("productType" = 'SUBSCRIPTION_PLAN' AND "subscriptionId" IS NOT NULL AND "purchaseId" IS NULL)
    OR
    ("productType" IN ('CREDIT_PACKAGE', 'CREDIT_VOLUME') AND "subscriptionId" IS NULL AND "purchaseId" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "PaymentAttempt_subscriptionId_key" ON "PaymentAttempt"("subscriptionId");
CREATE UNIQUE INDEX "PaymentAttempt_purchaseId_key" ON "PaymentAttempt"("purchaseId");
CREATE UNIQUE INDEX "PaymentAttempt_externalReference_key" ON "PaymentAttempt"("externalReference");
CREATE UNIQUE INDEX "PaymentAttempt_providerPreferenceId_key" ON "PaymentAttempt"("providerPreferenceId");
CREATE UNIQUE INDEX "PaymentAttempt_providerPaymentId_key" ON "PaymentAttempt"("providerPaymentId");
CREATE UNIQUE INDEX "PaymentAttempt_organizationId_idempotencyKey_key" ON "PaymentAttempt"("organizationId", "idempotencyKey");
CREATE INDEX "PaymentAttempt_organizationId_status_createdAt_idx" ON "PaymentAttempt"("organizationId", "status", "createdAt" DESC);
CREATE INDEX "PaymentAttempt_userId_createdAt_idx" ON "PaymentAttempt"("userId", "createdAt" DESC);

ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "OrganizationSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OneTimePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
