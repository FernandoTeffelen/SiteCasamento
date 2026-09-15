-- CreateTable
CREATE TABLE "CreditVolumeTier" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "minCredits" INTEGER NOT NULL,
    "maxCredits" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CreditVolumeTier_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CreditVolumeTier_minCredits_check" CHECK ("minCredits" >= 11),
    CONSTRAINT "CreditVolumeTier_maxCredits_check" CHECK ("maxCredits" >= "minCredits" AND "maxCredits" <= 30),
    CONSTRAINT "CreditVolumeTier_unitPriceCents_check" CHECK ("unitPriceCents" > 0)
);

CREATE UNIQUE INDEX "CreditVolumeTier_slug_key" ON "CreditVolumeTier"("slug");
CREATE INDEX "CreditVolumeTier_active_minCredits_maxCredits_idx" ON "CreditVolumeTier"("active", "minCredits", "maxCredits");
