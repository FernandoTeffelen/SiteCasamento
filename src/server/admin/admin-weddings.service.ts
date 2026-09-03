import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import { generateSecureWeddingToken } from "@/server/events/wedding.service";
import { objectStorage } from "@/server/storage/object-storage";
import { WeddingStatus, WeddingTemplateTier } from "@/generated/prisma/client";
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

export async function getAdminDashboardData(userId: string) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId },
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
        take: 8,
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

export async function createAdminWedding(input: {
  userId: string;
  name?: string;
  brideName: string;
  groomName: string;
  eventDate?: string | null;
}) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Você não possui uma organização vinculada.");
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
      status: WeddingStatus.ACTIVE,
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

  return wedding;
}

export async function getAdminPhotoStream(input: { userId: string; photoId: string }) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
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

  const stored = await objectStorage.get(photo.storageKey);
  return {
    body: stored.body,
    contentType: photo.contentType,
  };
}

export async function deleteAdminWedding(input: { userId: string; weddingId: string }) {
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.userId },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Você não possui acesso a esta organização.");
  }

  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: membership.organizationId },
  });

  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");
  }

  await prisma.wedding.delete({
    where: { id: wedding.id },
  });

  return { id: wedding.id, deleted: true };
}
