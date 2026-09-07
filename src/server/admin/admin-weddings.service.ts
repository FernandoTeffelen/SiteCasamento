import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import {
  generateSecureWeddingToken,
  restoreWeddingPublicAccess,
  revokeWeddingPublicAccess,
} from "@/server/events/wedding.service";
import { objectStorage } from "@/server/storage/object-storage";
import { activateWeddingWithCredit } from "@/server/billing/credit.service";
import { confirmAdminPassword } from "@/server/auth/admin-auth.service";
import { OrganizationRole, WeddingStatus, WeddingTemplateTier } from "@/generated/prisma/client";
import { defaultWeddingVisualConfig } from "@/lib/templates/wedding-visual-config";

export type AdminDashboardWedding = {
  id: string;
  publicId: string;
  slug: string | null;
  name: string;
  brideName: string;
  groomName: string;
  eventDate: Date | null;
  status: WeddingStatus;
  publicAccessStartsAt: Date | null;
  publicAccessEndsAt: Date | null;
  publicAccessRevokedAt: Date | null;
  createdAt: Date;
  guestCount: number;
  photoCount: number;
  recentPhotos: Array<{
    id: string;
    guestName: string;
    missionTitle: string;
    contentType: string;
    createdAt: Date;
  }>;
  topGuests: Array<{
    id: string;
    name: string;
    score: number;
  }>;
};

export type AdminGalleryPhoto = {
  id: string;
  guestId: string;
  guestName: string;
  missionId: string;
  missionTitle: string;
  contentType: string;
  createdAt: Date;
};

async function findAdminMembership(userId: string, options: { manage?: boolean } = {}) {
  // A interface ainda trabalha com uma organização por vez; a ordenação torna
  // essa escolha determinística para usuários que participam de mais de uma.
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, role: true },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Organization access denied.");
  }
  if (options.manage && membership.role === OrganizationRole.MEMBER) {
    throw new DomainError("ORGANIZATION_MANAGEMENT_DENIED", 403, "Organization management access denied.");
  }
  return membership;
}

export async function getAdminDashboardData(userId: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      organization: {
        include: {
          creditBalance: true,
        },
      },
    },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Você não possui uma organização vinculada.");
  }

  const organization = membership.organization;

  const weddings = await prisma.wedding.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          guests: true,
          photos: true,
        },
      },
      photos: {
        orderBy: { createdAt: "desc" },
        take: 7,
        include: {
          guest: { select: { name: true } },
          mission: { select: { title: true } },
        },
      },
      guests: {
        orderBy: [{ score: "desc" }, { createdAt: "asc" }],
        take: 5,
        select: {
          id: true,
          name: true,
          score: true,
        },
      },
    },
  });

  const formattedWeddings: AdminDashboardWedding[] = weddings.map((w) => ({
    id: w.id,
    publicId: w.publicId,
    slug: w.slug,
    name: w.name,
    brideName: w.brideName,
    groomName: w.groomName,
    eventDate: w.eventDate,
    status: w.status,
    publicAccessStartsAt: w.publicAccessStartsAt,
    publicAccessEndsAt: w.publicAccessEndsAt,
    publicAccessRevokedAt: w.publicAccessRevokedAt,
    createdAt: w.createdAt,
    guestCount: w._count.guests,
    photoCount: w._count.photos,
    recentPhotos: w.photos.map((p) => ({
      id: p.id,
      guestName: p.guest.name,
      missionTitle: p.mission.title,
      contentType: p.contentType,
      createdAt: p.createdAt,
    })),
    topGuests: w.guests.map((g) => ({
      id: g.id,
      name: g.name,
      score: g.score,
    })),
  }));

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      balance: organization.creditBalance?.balance ?? 0,
    },
    weddings: formattedWeddings,
  };
}

export async function getAdminWeddingGallery(input: {
  userId: string;
  weddingId: string;
  page?: number;
  pageSize?: number;
  guestId?: string;
  missionId?: string;
}) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Acesso negado.");
  }

  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: membership.organizationId },
    select: { id: true, name: true, brideName: true, groomName: true },
  });

  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento nÃ£o encontrado nesta organizaÃ§Ã£o.");
  }

  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 24;
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 48) {
    throw new DomainError("INVALID_GALLERY_PAGINATION", 400, "PaginaÃ§Ã£o invÃ¡lida.");
  }

  const guestId = input.guestId?.trim() || undefined;
  const missionId = input.missionId?.trim() || undefined;
  const photoWhere = {
    organizationId: membership.organizationId,
    weddingId: wedding.id,
    ...(guestId ? { guestId } : {}),
    ...(missionId ? { missionId } : {}),
  };

  const [total, photos, guests, missions] = await Promise.all([
    prisma.photo.count({ where: photoWhere }),
    prisma.photo.findMany({
      where: photoWhere,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        guestId: true,
        missionId: true,
        contentType: true,
        createdAt: true,
        guest: { select: { name: true } },
        mission: { select: { title: true } },
      },
    }),
    prisma.guest.findMany({
      where: { organizationId: membership.organizationId, weddingId: wedding.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.mission.findMany({
      where: { organizationId: membership.organizationId, weddingId: wedding.id },
      orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
      select: { id: true, title: true },
    }),
  ]);

  const formattedPhotos: AdminGalleryPhoto[] = photos.map((photo) => ({
    id: photo.id,
    guestId: photo.guestId,
    guestName: photo.guest.name,
    missionId: photo.missionId,
    missionTitle: photo.mission.title,
    contentType: photo.contentType,
    createdAt: photo.createdAt,
  }));

  return {
    wedding,
    photos: formattedPhotos,
    filters: { guests, missions },
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function createAdminWedding(input: {
  userId: string;
  name?: string;
  brideName: string;
  groomName: string;
  eventDate?: string | null;
}) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Você não possui uma organização vinculada.");
  }
  if (membership.role === OrganizationRole.MEMBER) {
    throw new DomainError("ORGANIZATION_MANAGEMENT_DENIED", 403, "Você não pode administrar esta organização.");
  }

  const brideName = input.brideName.trim();
  const groomName = input.groomName.trim();
  if (!brideName || !groomName) {
    throw new DomainError("INVALID_WEDDING_DATA", 400, "Informe os nomes da noiva e do noivo.");
  }

  const weddingName = input.name?.trim() || `Casamento de ${brideName} & ${groomName}`;
  const publicId = generateSecureWeddingToken();
  const now = new Date();
  const endsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 ano de janela padrão

  let parsedEventDate: Date | null = null;
  if (input.eventDate) {
    parsedEventDate = new Date(input.eventDate);
    if (isNaN(parsedEventDate.getTime())) {
      parsedEventDate = null;
    }
  }

  // Obter ou criar template padrão
  let template = await prisma.weddingTemplate.findFirst({
    where: { tier: WeddingTemplateTier.FREE, active: true },
  });

  if (!template) {
    template = await prisma.weddingTemplate.create({
      data: {
        slug: "classico-default",
        name: "Romance Clássico",
        tier: WeddingTemplateTier.FREE,
        defaultConfig: defaultWeddingVisualConfig,
      },
    });
  }

  const wedding = await prisma.wedding.create({
    data: {
      organizationId: membership.organizationId,
      templateId: template.id,
      publicId,
      name: weddingName,
      brideName,
      groomName,
      eventDate: parsedEventDate ?? now,
      // O casamento só fica público depois que a ativação consumir um crédito.
      status: WeddingStatus.DRAFT,
      publicAccessStartsAt: now,
      publicAccessEndsAt: endsAt,
    },
  });

  // Criar missões padrão para o jogo já nascer pronto
  await prisma.mission.createMany({
    data: [
      {
        organizationId: membership.organizationId,
        weddingId: wedding.id,
        title: "Os noivos dançando",
        description: "Registre um momento especial do casal na pista de dança.",
        points: 100,
        displayOrder: 1,
      },
      {
        organizationId: membership.organizationId,
        weddingId: wedding.id,
        title: "Uma nova amizade",
        description: "Tire uma selfie com alguém que você acabou de conhecer no casamento.",
        points: 80,
        displayOrder: 2,
      },
      {
        organizationId: membership.organizationId,
        weddingId: wedding.id,
        title: "Hora do brinde",
        description: "Fotografe as taças erguidas para celebrar o amor dos noivos.",
        points: 70,
        displayOrder: 3,
      },
      {
        organizationId: membership.organizationId,
        weddingId: wedding.id,
        title: "O corte do bolo",
        description: "Capture o momento doce do corte do bolo pelos recém-casados.",
        points: 90,
        displayOrder: 4,
      },
      {
        organizationId: membership.organizationId,
        weddingId: wedding.id,
        title: "Emoção na cerimônia",
        description: "Registre os olhares e lágrimas de felicidade dos noivos ou familiares.",
        points: 100,
        displayOrder: 5,
      },
    ],
  });

  // A baixa é feita no backend, em transação serializável, para impedir que
  // requisições simultâneas gastem o mesmo crédito.
  try {
    await activateWeddingWithCredit({
      organizationId: membership.organizationId,
      weddingId: wedding.id,
    });
  } catch (error) {
    // Não deixe um rascunho órfão ocupar a lista nem permitir uma ativação
    // posterior fora do fluxo de criação que falhou.
    await prisma.wedding.deleteMany({
      where: { id: wedding.id, organizationId: membership.organizationId, status: WeddingStatus.DRAFT },
    });
    throw error;
  }

  return { ...wedding, status: WeddingStatus.ACTIVE };
}

export async function getAdminPhotoStream(input: { userId: string; photoId: string; storage?: typeof objectStorage }) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Acesso negado.");
  }

  const photo = await prisma.photo.findFirst({
    where: { id: input.photoId, organizationId: membership.organizationId },
    select: { storageKey: true, contentType: true },
  });

  if (!photo) {
    throw new DomainError("PHOTO_NOT_FOUND", 404, "Foto não encontrada.");
  }

  const stored = await (input.storage ?? objectStorage).get(photo.storageKey);
  return {
    body: stored.body,
    contentType: photo.contentType,
  };
}

async function findAdminOrganization(userId: string) {
  return (await findAdminMembership(userId, { manage: true })).organizationId;
}

export async function setAdminWeddingPublicAccess(input: {
  userId: string;
  weddingId: string;
  revoked: boolean;
}) {
  const organizationId = await findAdminOrganization(input.userId);
  const operation = input.revoked ? revokeWeddingPublicAccess : restoreWeddingPublicAccess;
  return operation({ organizationId, weddingId: input.weddingId });
}

export async function deleteAdminWedding(input: { userId: string; weddingId: string; password: unknown }) {
  await confirmAdminPassword({ userId: input.userId, password: input.password });

  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Você não possui acesso a esta organização.");
  }
  if (membership.role === OrganizationRole.MEMBER) {
    throw new DomainError("ORGANIZATION_MANAGEMENT_DENIED", 403, "Você não pode administrar esta organização.");
  }

  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: membership.organizationId },
    select: {
      id: true,
      photos: { select: { storageKey: true } },
    },
  });

  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");
  }

  await prisma.$transaction(async (transaction) => {
    // O lançamento de consumo é imutável, mas sua referência não pode apontar
    // para um casamento apagado. Mantemos o histórico financeiro na organização.
    await transaction.creditLedgerEntry.updateMany({
      where: { organizationId: membership.organizationId, weddingId: wedding.id },
      data: { weddingId: null },
    });
    await transaction.wedding.delete({ where: { id: wedding.id } });
  });

  await Promise.all(wedding.photos.map((photo) => objectStorage.delete(photo.storageKey).catch(() => undefined)));

  return { id: wedding.id, deleted: true };
}
