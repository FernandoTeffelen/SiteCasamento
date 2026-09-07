import { prisma } from "@/server/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/server/domain/error";
import { assertWeddingIsActive, findWeddingByPublicAccessToken, type PublicWedding } from "@/server/events/wedding.service";
import { objectStorage } from "@/server/storage/object-storage";
import type { ObjectStorage } from "@/lib/storage/types";

export type GuestIdentity = {
  id: string;
  organizationId: string;
  token: string;
  name: string;
  email: string | null;
  age: number | null;
  relationshipToCouple: string | null;
  hasAvatar: boolean;
  updatedAt: Date;
  score: number;
  weddingId: string;
};

type GuestRecord = Omit<GuestIdentity, "hasAvatar"> & {
  avatarStorageKey: string | null;
  avatarContentType: string | null;
};

export type GuestAvatarFile = {
  size: number;
  type: string;
  name?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

const guestSelect = {
  id: true,
  token: true,
  name: true,
  email: true,
  age: true,
  relationshipToCouple: true,
  avatarStorageKey: true,
  avatarContentType: true,
  score: true,
  weddingId: true,
  organizationId: true,
  updatedAt: true,
} as const;

function toGuestIdentity(guest: GuestRecord): GuestIdentity {
  return {
    id: guest.id,
    organizationId: guest.organizationId,
    token: guest.token,
    name: guest.name,
    email: guest.email,
    age: guest.age,
    relationshipToCouple: guest.relationshipToCouple,
    score: guest.score,
    weddingId: guest.weddingId,
    updatedAt: guest.updatedAt,
    hasAvatar: Boolean(guest.avatarStorageKey && guest.avatarContentType),
  };
}

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

function normalizeGuestEmail(email: unknown) {
  if (email === null || email === undefined || email === "") return null;
  if (typeof email !== "string") {
    throw new DomainError("INVALID_GUEST_EMAIL", 400, "Informe um e-mail válido.");
  }

  const normalizedEmail = email.trim().toLocaleLowerCase("en-US");
  if (
    normalizedEmail.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw new DomainError("INVALID_GUEST_EMAIL", 400, "Informe um e-mail válido.");
  }
  return normalizedEmail;
}

function isUniqueGuestEmailError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function normalizeGuestToken(token: unknown) {
  if (typeof token !== "string" || token.length < 10 || token.length > 100) {
    return null;
  }

  return token;
}

function normalizeGuestAge(age: unknown) {
  if (age === null || age === undefined || age === "") return null;
  const parsedAge = typeof age === "number" ? age : Number(age);
  if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
    throw new DomainError("INVALID_GUEST_AGE", 400, "Informe uma idade entre 1 e 120 anos ou deixe em branco.");
  }
  return parsedAge;
}

function normalizeRelationshipToCouple(relationshipToCouple: unknown) {
  if (relationshipToCouple === null || relationshipToCouple === undefined || relationshipToCouple === "") return null;
  if (typeof relationshipToCouple !== "string") {
    throw new DomainError("INVALID_GUEST_RELATIONSHIP", 400, "Informe como conhece o casal em texto.");
  }
  const normalizedRelationship = relationshipToCouple.trim().replace(/\s+/g, " ");
  if (normalizedRelationship.length > 120) {
    throw new DomainError("INVALID_GUEST_RELATIONSHIP", 400, "Conte em até 120 caracteres como conhece o casal.");
  }
  return normalizedRelationship || null;
}

function isJpeg(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

function isPng(bytes: Uint8Array) {
  return bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a;
}

function isWebp(bytes: Uint8Array) {
  return bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
}

async function validateGuestAvatar(file: GuestAvatarFile) {
  const contentType = file.type.toLowerCase().trim();
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new DomainError("UNSUPPORTED_AVATAR_FORMAT", 415, "Escolha uma foto em JPEG, PNG ou WebP.");
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 5 * 1024 * 1024) {
    throw new DomainError("INVALID_AVATAR", 400, "A foto de perfil deve ter até 5 MB.");
  }
  const body = new Uint8Array(await file.arrayBuffer());
  const matchesContent = (contentType === "image/jpeg" && isJpeg(body))
    || (contentType === "image/png" && isPng(body))
    || (contentType === "image/webp" && isWebp(body));
  if (body.byteLength !== file.size || !matchesContent) {
    throw new DomainError("INVALID_AVATAR_CONTENT", 415, "O arquivo não corresponde a uma imagem válida.");
  }
  return { body, contentType };
}

export async function registerOrIdentifyGuest(
  eventIdentifier: string,
  input: { name: unknown; email?: unknown; guestToken?: unknown },
): Promise<{ wedding: PublicWedding; guest: GuestIdentity; created: boolean }> {
  const wedding = await findWeddingByPublicAccessToken(eventIdentifier);
  assertWeddingIsActive(wedding);
  const name = normalizeGuestName(input.name);
  const email = normalizeGuestEmail(input.email);
  const existingToken = normalizeGuestToken(input.guestToken);

  if (existingToken) {
    const existingGuest = await prisma.guest.findFirst({
      where: { organizationId: wedding.organizationId, weddingId: wedding.id, token: existingToken },
      select: guestSelect,
    });

    if (existingGuest && (!existingGuest.email || !email || existingGuest.email === email)) {
      if (existingGuest.email && email && existingGuest.email !== email) {
        throw new DomainError("GUEST_EMAIL_MISMATCH", 409, "Este aparelho já está vinculado a outro e-mail neste casamento.");
      }
      if (!existingGuest.email && email) {
        try {
          const updatedGuest = await prisma.guest.update({
            where: { id: existingGuest.id },
            data: { email },
            select: guestSelect,
          });
          return { wedding, guest: toGuestIdentity(updatedGuest), created: false };
        } catch (error) {
          if (isUniqueGuestEmailError(error)) {
            throw new DomainError("GUEST_EMAIL_IN_USE", 409, "Este e-mail já foi usado por outro convidado neste casamento.");
          }
          throw error;
        }
      }
      if (existingGuest.name !== name) {
        const updatedGuest = await prisma.guest.update({
          where: { id: existingGuest.id },
          data: { name },
          select: guestSelect,
        });
        return { wedding, guest: toGuestIdentity(updatedGuest), created: false };
      }
      return { wedding, guest: toGuestIdentity(existingGuest), created: false };
    }
  }

  // Um nome diferente no mesmo aparelho inicia uma nova identidade. Isso evita
  // que o primeiro convidado fique preso ao formulário para sempre, sem
  // permitir que o token de outro casamento seja reutilizado.
  if (!email) {
    throw new DomainError("GUEST_EMAIL_REQUIRED", 400, "Informe seu e-mail para diferenciar seu perfil no casamento.");
  }

  let guest;
  try {
    guest = await prisma.guest.create({
      data: { organizationId: wedding.organizationId, weddingId: wedding.id, name, email },
      select: guestSelect,
    });
  } catch (error) {
    if (isUniqueGuestEmailError(error)) {
      throw new DomainError("GUEST_EMAIL_IN_USE", 409, "Este e-mail já foi usado por outro convidado neste casamento.");
    }
    throw error;
  }

  return { wedding, guest: toGuestIdentity(guest), created: true };
}

export async function findGuestForWedding(
  wedding: Pick<PublicWedding, "id" | "organizationId">,
  guestToken: string,
): Promise<GuestIdentity> {
  const guest = await prisma.guest.findFirst({
    where: { organizationId: wedding.organizationId, weddingId: wedding.id, token: guestToken },
    select: guestSelect,
  });

  if (!guest) {
    throw new DomainError("GUEST_NOT_FOUND", 404, "Convidado não encontrado neste casamento.");
  }

  return toGuestIdentity(guest);
}

export async function getGuestContext(eventIdentifier: string, guestToken: string) {
  const wedding = await findWeddingByPublicAccessToken(eventIdentifier);
  assertWeddingIsActive(wedding);
  const guest = await findGuestForWedding(wedding, guestToken);
  return { wedding, guest };
}

export async function updateGuestProfile(input: {
  eventIdentifier: string;
  guestToken: unknown;
  name: unknown;
  age?: unknown;
  relationshipToCouple?: unknown;
  email?: unknown;
  avatar?: GuestAvatarFile | null;
  clearAvatar?: unknown;
  storage?: ObjectStorage;
}) {
  const guestToken = normalizeGuestToken(input.guestToken);
  if (!guestToken) throw new DomainError("INVALID_GUEST_TOKEN", 400, "Identificação do convidado inválida.");
  const name = normalizeGuestName(input.name);
  const age = normalizeGuestAge(input.age);
  const relationshipToCouple = normalizeRelationshipToCouple(input.relationshipToCouple);
  const email = input.email === undefined ? undefined : normalizeGuestEmail(input.email);
  const { wedding, guest } = await getGuestContext(input.eventIdentifier, guestToken);
  const existingGuest = await prisma.guest.findFirstOrThrow({
    where: { id: guest.id, organizationId: wedding.organizationId, weddingId: wedding.id },
    select: guestSelect,
  });

  if (existingGuest.email && email === null) {
    throw new DomainError("GUEST_EMAIL_REQUIRED", 400, "O e-mail de identificação não pode ser removido.");
  }

  const shouldClearAvatar = input.clearAvatar === true || input.clearAvatar === "true";
  if (input.avatar && shouldClearAvatar) {
    throw new DomainError("INVALID_AVATAR_UPDATE", 400, "Escolha uma nova foto ou remova a atual.");
  }

  let newAvatar: { storageKey: string; contentType: string } | null = null;
  if (input.avatar) {
    const avatar = await validateGuestAvatar(input.avatar);
    const storageKey = `weddings/${wedding.id}/guests/${guest.id}/profile/${crypto.randomUUID()}`;
    try {
      await (input.storage ?? objectStorage).put({ storageKey, body: avatar.body, contentType: avatar.contentType });
      newAvatar = { storageKey, contentType: avatar.contentType };
    } catch {
      throw new DomainError("AVATAR_STORAGE_FAILED", 503, "Não foi possível salvar sua foto de perfil agora.");
    }
  }

  try {
    const updatedGuest = await prisma.guest.update({
      where: { id: guest.id },
      data: {
        name,
        ...(email === undefined ? {} : { email }),
        age,
        relationshipToCouple,
        ...(newAvatar
          ? { avatarStorageKey: newAvatar.storageKey, avatarContentType: newAvatar.contentType }
          : shouldClearAvatar ? { avatarStorageKey: null, avatarContentType: null } : {}),
      },
      select: guestSelect,
    });
    if ((newAvatar || shouldClearAvatar) && existingGuest.avatarStorageKey) {
      await (input.storage ?? objectStorage).delete(existingGuest.avatarStorageKey).catch(() => undefined);
    }
    return { wedding, guest: toGuestIdentity(updatedGuest) };
  } catch (error) {
    if (newAvatar) await (input.storage ?? objectStorage).delete(newAvatar.storageKey).catch(() => undefined);
    if (isUniqueGuestEmailError(error)) {
      throw new DomainError("GUEST_EMAIL_IN_USE", 409, "Este e-mail já foi usado por outro convidado neste casamento.");
    }
    throw error;
  }
}

export async function getGuestAvatar(input: {
  eventIdentifier: string;
  guestToken: unknown;
  storage?: ObjectStorage;
}) {
  const guestToken = normalizeGuestToken(input.guestToken);
  if (!guestToken) throw new DomainError("INVALID_GUEST_TOKEN", 400, "Identificação do convidado inválida.");
  const { wedding, guest } = await getGuestContext(input.eventIdentifier, guestToken);
  const avatar = await prisma.guest.findFirst({
    where: { id: guest.id, organizationId: wedding.organizationId, weddingId: wedding.id },
    select: { avatarStorageKey: true, avatarContentType: true },
  });
  if (!avatar?.avatarStorageKey || !avatar.avatarContentType) {
    throw new DomainError("GUEST_AVATAR_NOT_FOUND", 404, "Este convidado ainda não adicionou uma foto de perfil.");
  }
  const storedAvatar = await (input.storage ?? objectStorage).get(avatar.avatarStorageKey).catch(() => {
    throw new DomainError("GUEST_AVATAR_NOT_FOUND", 404, "A foto de perfil não está disponível.");
  });
  return { body: storedAvatar.body, contentType: avatar.avatarContentType };
}
