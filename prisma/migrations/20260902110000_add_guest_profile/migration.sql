-- Guest profiles extend the existing token-based identity. Every field is
-- optional so the QR-code entry flow remains name-only and frictionless.
ALTER TABLE "Guest"
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "relationshipToCouple" TEXT,
  ADD COLUMN "avatarStorageKey" TEXT,
  ADD COLUMN "avatarContentType" TEXT;
