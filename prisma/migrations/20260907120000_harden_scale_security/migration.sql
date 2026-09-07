-- Consultas administrativas por organização e paginação estável do Book.
CREATE INDEX "Wedding_organizationId_createdAt_idx"
  ON "Wedding"("organizationId", "createdAt" DESC);

DROP INDEX "Photo_organizationId_weddingId_createdAt_idx";
CREATE INDEX "Photo_organizationId_weddingId_createdAt_id_idx"
  ON "Photo"("organizationId", "weddingId", "createdAt" DESC, "id" DESC);

-- Fluxo idempotente de upload e leitura das missões de um convidado.
CREATE INDEX "Submission_organizationId_weddingId_guestId_createdAt_idx"
  ON "Submission"("organizationId", "weddingId", "guestId", "createdAt");
CREATE INDEX "Submission_organizationId_weddingId_guestId_missionId_status_idx"
  ON "Submission"("organizationId", "weddingId", "guestId", "missionId", "status");
