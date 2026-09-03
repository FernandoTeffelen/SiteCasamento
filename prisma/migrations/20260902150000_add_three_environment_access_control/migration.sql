CREATE TYPE "PlatformRole" AS ENUM ('USER', 'PLATFORM_ADMIN');

ALTER TABLE "User"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordUpdatedAt" TIMESTAMP(3),
  ADD COLUMN "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER';

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_userId_expiresAt_idx" ON "AdminSession"("userId", "expiresAt");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Wedding"
  ADD COLUMN "publicAccessStartsAt" TIMESTAMP(3),
  ADD COLUMN "publicAccessEndsAt" TIMESTAMP(3),
  ADD COLUMN "publicAccessRevokedAt" TIMESTAMP(3);

-- Eventos ativos existentes recebem uma janela segura de transição. Novas
-- ativações passam a exigir uma janela explícita na camada de domínio.
UPDATE "Wedding"
SET "publicAccessStartsAt" = CURRENT_TIMESTAMP - INTERVAL '1 day',
    "publicAccessEndsAt" = CURRENT_TIMESTAMP + INTERVAL '365 days'
WHERE "status" = 'ACTIVE'
  AND "publicAccessStartsAt" IS NULL
  AND "publicAccessEndsAt" IS NULL;

ALTER TABLE "Wedding"
  ADD CONSTRAINT "Wedding_publicAccessWindow_complete" CHECK (
    ("publicAccessStartsAt" IS NULL AND "publicAccessEndsAt" IS NULL)
    OR ("publicAccessStartsAt" IS NOT NULL AND "publicAccessEndsAt" IS NOT NULL AND "publicAccessEndsAt" > "publicAccessStartsAt")
  ),
  ADD CONSTRAINT "Wedding_active_requires_publicAccessWindow" CHECK (
    "status" <> 'ACTIVE' OR ("publicAccessStartsAt" IS NOT NULL AND "publicAccessEndsAt" IS NOT NULL)
  );

CREATE INDEX "Wedding_status_publicAccessStartsAt_publicAccessEndsAt_idx"
  ON "Wedding"("status", "publicAccessStartsAt", "publicAccessEndsAt");
