CREATE TYPE "WeddingTemplateTier" AS ENUM ('FREE', 'PREMIUM');

CREATE TABLE "WeddingTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "tier" "WeddingTemplateTier" NOT NULL DEFAULT 'FREE',
    "thumbnailUrl" TEXT,
    "previewUrl" TEXT,
    "defaultConfig" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WeddingCustomization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weddingId" TEXT NOT NULL,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeddingCustomization_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Wedding" ADD COLUMN "templateId" TEXT;

CREATE UNIQUE INDEX "WeddingTemplate_slug_key" ON "WeddingTemplate"("slug");
CREATE INDEX "WeddingTemplate_tier_active_idx" ON "WeddingTemplate"("tier", "active");
CREATE INDEX "Wedding_templateId_idx" ON "Wedding"("templateId");
CREATE UNIQUE INDEX "WeddingCustomization_weddingId_key" ON "WeddingCustomization"("weddingId");
CREATE UNIQUE INDEX "WeddingCustomization_id_weddingId_organizationId_key" ON "WeddingCustomization"("id", "weddingId", "organizationId");
CREATE UNIQUE INDEX "WeddingCustomization_weddingId_organizationId_key" ON "WeddingCustomization"("weddingId", "organizationId");
CREATE INDEX "WeddingCustomization_organizationId_weddingId_idx" ON "WeddingCustomization"("organizationId", "weddingId");

ALTER TABLE "Wedding" ADD CONSTRAINT "Wedding_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WeddingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WeddingCustomization" ADD CONSTRAINT "WeddingCustomization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WeddingCustomization" ADD CONSTRAINT "WeddingCustomization_weddingId_organizationId_fkey" FOREIGN KEY ("weddingId", "organizationId") REFERENCES "Wedding"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
