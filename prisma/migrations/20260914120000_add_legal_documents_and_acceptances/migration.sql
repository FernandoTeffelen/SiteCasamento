-- CreateEnum
CREATE TYPE "LegalDocumentType" AS ENUM ('PRIVACY_POLICY', 'TERMS_OF_USE', 'COMMERCIAL_TERMS');

-- CreateEnum
CREATE TYPE "LegalAcceptanceContext" AS ENUM ('REGISTRATION', 'CHECKOUT', 'PHOTO_SUBMISSION');

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "type" "LegalDocumentType" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "publicPath" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalAcceptance" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "context" "LegalAcceptanceContext" NOT NULL,
    "userId" TEXT,
    "guestId" TEXT,
    "organizationId" TEXT,
    "contextReference" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientAcceptedAt" TIMESTAMP(3),
    "ipAddress" VARCHAR(45),
    "userAgent" VARCHAR(512),
    "contextSnapshot" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    CONSTRAINT "LegalAcceptance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LegalDocumentVersion_type_version_key" ON "LegalDocumentVersion"("type", "version");
CREATE INDEX "LegalDocumentVersion_type_active_effectiveAt_idx" ON "LegalDocumentVersion"("type", "active", "effectiveAt" DESC);
CREATE UNIQUE INDEX "LegalAcceptance_idempotencyKey_key" ON "LegalAcceptance"("idempotencyKey");
CREATE INDEX "LegalAcceptance_userId_acceptedAt_idx" ON "LegalAcceptance"("userId", "acceptedAt" DESC);
CREATE INDEX "LegalAcceptance_guestId_acceptedAt_idx" ON "LegalAcceptance"("guestId", "acceptedAt" DESC);
CREATE INDEX "LegalAcceptance_organizationId_acceptedAt_idx" ON "LegalAcceptance"("organizationId", "acceptedAt" DESC);
CREATE INDEX "LegalAcceptance_documentVersionId_acceptedAt_idx" ON "LegalAcceptance"("documentVersionId", "acceptedAt" DESC);

ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LegalAcceptance" ADD CONSTRAINT "LegalAcceptance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
