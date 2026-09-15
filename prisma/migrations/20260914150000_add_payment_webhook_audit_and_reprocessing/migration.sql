-- CreateEnum
CREATE TYPE "PaymentWebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "PaymentProcessingTrigger" AS ENUM ('WEBHOOK', 'MANUAL_REPROCESS');

-- CreateEnum
CREATE TYPE "PaymentProcessingStatus" AS ENUM ('STARTED', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "PaymentAttempt"
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "lastErrorMessage" VARCHAR(2000),
  ADD COLUMN "lastProcessedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PaymentWebhookEvent" (
  "id" TEXT NOT NULL,
  "paymentAttemptId" TEXT,
  "provider" "PaymentProvider" NOT NULL DEFAULT 'MERCADO_PAGO',
  "providerPaymentId" TEXT NOT NULL,
  "notificationType" TEXT NOT NULL,
  "action" TEXT,
  "deliveryKey" TEXT NOT NULL,
  "signatureValid" BOOLEAN NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "PaymentWebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "processingCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT,
  "lastErrorMessage" VARCHAR(2000),
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "nextRetryAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentWebhookEvent_processingCount_check" CHECK ("processingCount" >= 0)
);

-- CreateTable
CREATE TABLE "PaymentProcessingAttempt" (
  "id" TEXT NOT NULL,
  "paymentAttemptId" TEXT,
  "webhookEventId" TEXT,
  "trigger" "PaymentProcessingTrigger" NOT NULL,
  "status" "PaymentProcessingStatus" NOT NULL DEFAULT 'STARTED',
  "errorCode" TEXT,
  "errorMessage" VARCHAR(2000),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentProcessingAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentWebhookEvent_deliveryKey_key" ON "PaymentWebhookEvent"("deliveryKey");
CREATE INDEX "PaymentWebhookEvent_provider_providerPaymentId_receivedAt_idx" ON "PaymentWebhookEvent"("provider", "providerPaymentId", "receivedAt" DESC);
CREATE INDEX "PaymentWebhookEvent_status_nextRetryAt_idx" ON "PaymentWebhookEvent"("status", "nextRetryAt");
CREATE INDEX "PaymentWebhookEvent_paymentAttemptId_receivedAt_idx" ON "PaymentWebhookEvent"("paymentAttemptId", "receivedAt" DESC);
CREATE INDEX "PaymentProcessingAttempt_paymentAttemptId_createdAt_idx" ON "PaymentProcessingAttempt"("paymentAttemptId", "createdAt" DESC);
CREATE INDEX "PaymentProcessingAttempt_webhookEventId_createdAt_idx" ON "PaymentProcessingAttempt"("webhookEventId", "createdAt" DESC);
CREATE INDEX "PaymentProcessingAttempt_status_createdAt_idx" ON "PaymentProcessingAttempt"("status", "createdAt");

ALTER TABLE "PaymentWebhookEvent" ADD CONSTRAINT "PaymentWebhookEvent_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentProcessingAttempt" ADD CONSTRAINT "PaymentProcessingAttempt_paymentAttemptId_fkey" FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaymentProcessingAttempt" ADD CONSTRAINT "PaymentProcessingAttempt_webhookEventId_fkey" FOREIGN KEY ("webhookEventId") REFERENCES "PaymentWebhookEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
