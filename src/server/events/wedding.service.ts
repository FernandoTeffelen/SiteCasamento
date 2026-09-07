import crypto from "node:crypto";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

export type PublicWedding = {
  id: string;
  organizationId: string;
  publicId: string;
  slug: string | null;
  name: string;
  brideName: string;
  groomName: string;
  eventDate: Date | null;
  publicAccessStartsAt: Date | null;
  publicAccessEndsAt: Date | null;
  publicAccessRevokedAt: Date | null;
  status: "DRAFT" | "ACTIVE" | "CLOSED" | "ARCHIVED";
};

export type PublicWeddingResponse = Pick<
  PublicWedding,
  "publicId" | "slug" | "name" | "brideName" | "groomName" | "eventDate" | "status"
>;

const SECURE_WEDDING_TOKEN_PATTERN = /^evt_[a-f0-9]{32}$/;

/**
 * Gera um token público opaco, não enumerável e criptograficamente seguro.
 * Exemplo: evt_4a8b1c9e2f3d4e5a6b7c8d9e0f1a2b3c
 */
export function generateSecureWeddingToken(): string {
  const randomPart = crypto.randomBytes(16).toString("hex");
  return `evt_${randomPart}`;
}

export function isSecureWeddingToken(value: string): boolean {
  return SECURE_WEDDING_TOKEN_PATTERN.test(value);
}

export function toPublicWeddingResponse(wedding: PublicWedding): PublicWeddingResponse {
  return {
    publicId: wedding.publicId,
    slug: wedding.slug,
    name: wedding.name,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    eventDate: wedding.eventDate,
    status: wedding.status,
  };
}

export async function findWeddingByIdentifier(identifier: string): Promise<PublicWedding> {
  const normalizedIdentifier = identifier.trim();

  if (!normalizedIdentifier) {
    throw new DomainError("INVALID_EVENT_IDENTIFIER", 400, "Identificador do casamento inválido.");
  }

  const wedding = await prisma.wedding.findFirst({
    where: {
      OR: [
        { slug: normalizedIdentifier },
        { publicId: normalizedIdentifier },
      ],
    },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      slug: true,
      name: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      publicAccessStartsAt: true,
      publicAccessEndsAt: true,
      publicAccessRevokedAt: true,
      status: true,
    },
  });

  if (!wedding) {
    throw new DomainError("EVENT_NOT_FOUND", 404, "Casamento não encontrado.");
  }

  return wedding;
}

/**
 * Resolved exclusively by the opaque QR/link token. Slugs and sequential IDs
 * are never valid public access keys.
 */
export async function findWeddingByPublicAccessToken(rawToken: string): Promise<PublicWedding> {
  if (typeof rawToken !== "string") {
    throw new DomainError("INVALID_EVENT_TOKEN", 400, "Token do casamento inválido.");
  }
  const publicId = rawToken.trim();
  if (!isSecureWeddingToken(publicId)) {
    throw new DomainError("INVALID_EVENT_TOKEN", 404, "Casamento não encontrado.");
  }

  // Bloqueia tentativas de enumeração por números/IDs sequenciais
  if (/^\d+$/.test(publicId)) {
    throw new DomainError("INVALID_EVENT_TOKEN", 404, "Casamento não encontrado.");
  }

  const wedding = await prisma.wedding.findUnique({
    where: { publicId },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      slug: true,
      name: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      publicAccessStartsAt: true,
      publicAccessEndsAt: true,
      publicAccessRevokedAt: true,
      status: true,
    },
  });
  if (!wedding) throw new DomainError("EVENT_NOT_FOUND", 404, "Casamento não encontrado.");
  return wedding;
}

export function assertWeddingIsActive(wedding: PublicWedding, referenceDate: Date = new Date()) {
  if (wedding.status !== "ACTIVE") {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "Este casamento não está disponível para convidados.");
  }

  const now = referenceDate;

  if (wedding.publicAccessRevokedAt !== null && wedding.publicAccessRevokedAt <= now) {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "O acesso a este casamento foi revogado.");
  }

  if (wedding.publicAccessStartsAt && wedding.publicAccessStartsAt > now) {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "O período de acesso a este casamento ainda não começou.");
  }

  if (wedding.publicAccessEndsAt && wedding.publicAccessEndsAt <= now) {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "O período de acesso a este casamento já encerrou.");
  }
}

/**
 * Revoga manualmente o acesso público a um casamento através de seu link/QR Code.
 * Todos os dados permanecem preservados no banco para a cerimonialista.
 */
export async function revokeWeddingPublicAccess(input: {
  organizationId: string;
  weddingId: string;
  revokedAt?: Date;
}): Promise<PublicWedding> {
  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: input.organizationId },
  });
  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado.");
  }

  const updated = await prisma.wedding.update({
    where: { id: input.weddingId },
    data: {
      publicAccessRevokedAt: input.revokedAt ?? new Date(),
    },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      slug: true,
      name: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      publicAccessStartsAt: true,
      publicAccessEndsAt: true,
      publicAccessRevokedAt: true,
      status: true,
    },
  });

  return updated;
}

/**
 * Restaura o acesso público de um casamento que havia sido revogado manualmente.
 */
export async function restoreWeddingPublicAccess(input: {
  organizationId: string;
  weddingId: string;
}): Promise<PublicWedding> {
  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: input.organizationId },
  });
  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado.");
  }

  const updated = await prisma.wedding.update({
    where: { id: input.weddingId },
    data: {
      publicAccessRevokedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      slug: true,
      name: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      publicAccessStartsAt: true,
      publicAccessEndsAt: true,
      publicAccessRevokedAt: true,
      status: true,
    },
  });

  return updated;
}

/**
 * Rotaciona o token público de um casamento.
 * O link/QR Code antigo é invalidado imediatamente e um novo token seguro é atribuído,
 * mantendo convidados, fotos, missões e pontuação 100% preservados.
 */
export async function rotateWeddingPublicToken(input: {
  organizationId: string;
  weddingId: string;
}): Promise<{ oldToken: string; newToken: string; wedding: PublicWedding }> {
  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: input.organizationId },
  });
  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado.");
  }

  const oldToken = wedding.publicId;
  const newToken = generateSecureWeddingToken();

  const updated = await prisma.wedding.update({
    where: { id: input.weddingId },
    data: {
      publicId: newToken,
      publicAccessRevokedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      slug: true,
      name: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      publicAccessStartsAt: true,
      publicAccessEndsAt: true,
      publicAccessRevokedAt: true,
      status: true,
    },
  });

  return { oldToken, newToken, wedding: updated };
}
