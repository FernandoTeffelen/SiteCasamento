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
 * Resolved exclusively by the opaque QR/link token. Slugs remain an internal
 * convenience for administration and legacy data, never a public access key.
 */
export async function findWeddingByPublicAccessToken(rawToken: string): Promise<PublicWedding> {
  const publicId = rawToken.trim();
  if (publicId.length < 16 || publicId.length > 100) {
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

export function assertWeddingIsActive(wedding: PublicWedding) {
  if (wedding.status !== "ACTIVE") {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "Este casamento não está disponível para convidados.");
  }
  const now = new Date();
  if (
    !wedding.publicAccessStartsAt
    || !wedding.publicAccessEndsAt
    || wedding.publicAccessStartsAt > now
    || wedding.publicAccessEndsAt <= now
    || (wedding.publicAccessRevokedAt !== null && wedding.publicAccessRevokedAt <= now)
  ) {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "Este casamento não está disponível para convidados.");
  }
}
