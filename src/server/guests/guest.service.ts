import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import { assertWeddingIsActive, findWeddingByIdentifier, type PublicWedding } from "@/server/events/wedding.service";

export type GuestIdentity = {
  id: string;
  token: string;
  name: string;
  score: number;
  weddingId: string;
};

function normalizeGuestName(name: unknown) {
  if (typeof name !== "string") {
    throw new DomainError("INVALID_GUEST_NAME", 400, "Informe seu nome ou apelido.");
  }

  const normalizedName = name.trim().replace(/\s+/g, " ");
  if (normalizedName.length < 1 || normalizedName.length > 40) {
    throw new DomainError("INVALID_GUEST_NAME", 400, "O nome deve ter entre 1 e 40 caracteres.");
  }

  return normalizedName;
}

function normalizeGuestToken(token: unknown) {
  if (typeof token !== "string" || token.length < 10 || token.length > 100) {
    return null;
  }

  return token;
}

export async function registerOrIdentifyGuest(
  eventIdentifier: string,
  input: { name: unknown; guestToken?: unknown },
): Promise<{ wedding: PublicWedding; guest: GuestIdentity; created: boolean }> {
  const wedding = await findWeddingByIdentifier(eventIdentifier);
  assertWeddingIsActive(wedding);
  const name = normalizeGuestName(input.name);
  const existingToken = normalizeGuestToken(input.guestToken);

  if (existingToken) {
    const existingGuest = await prisma.guest.findFirst({
      where: { weddingId: wedding.id, token: existingToken },
      select: { id: true, token: true, name: true, score: true, weddingId: true },
    });

    if (existingGuest) {
      return { wedding, guest: existingGuest, created: false };
    }
  }

  // Um token de outro casamento nunca é reutilizado: o servidor cria uma nova identidade local.
  const guest = await prisma.guest.create({
    data: { weddingId: wedding.id, name },
    select: { id: true, token: true, name: true, score: true, weddingId: true },
  });

  return { wedding, guest, created: true };
}

export async function findGuestForWedding(weddingId: string, guestToken: string): Promise<GuestIdentity> {
  const guest = await prisma.guest.findFirst({
    where: { weddingId, token: guestToken },
    select: { id: true, token: true, name: true, score: true, weddingId: true },
  });

  if (!guest) {
    throw new DomainError("GUEST_NOT_FOUND", 404, "Convidado não encontrado neste casamento.");
  }

  return guest;
}

export async function getGuestContext(eventIdentifier: string, guestToken: string) {
  const wedding = await findWeddingByIdentifier(eventIdentifier);
  assertWeddingIsActive(wedding);
  const guest = await findGuestForWedding(wedding.id, guestToken);
  return { wedding, guest };
}
