import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

export type PublicWedding = {
  id: string;
  publicId: string;
  slug: string | null;
  name: string;
  brideName: string;
  groomName: string;
  eventDate: Date | null;
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
      publicId: true,
      slug: true,
      name: true,
      brideName: true,
      groomName: true,
      eventDate: true,
      status: true,
    },
  });

  if (!wedding) {
    throw new DomainError("EVENT_NOT_FOUND", 404, "Casamento não encontrado.");
  }

  return wedding;
}

export function assertWeddingIsActive(wedding: PublicWedding) {
  if (wedding.status !== "ACTIVE") {
    throw new DomainError("EVENT_UNAVAILABLE", 403, "Este casamento não está disponível para convidados.");
  }
}
