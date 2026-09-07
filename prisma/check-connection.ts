import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  const weddingCount = await prisma.wedding.count();

  if (process.env.CHECK_DEMO_FIXTURES !== "true") {
    console.log(`Banco conectado. ${weddingCount} casamento(s) cadastrado(s).`);
    return;
  }

  const weddings = await prisma.wedding.findMany({
    where: { slug: { in: ["ana-e-joao", "beatriz-e-rafael"] } },
    orderBy: { slug: "asc" },
    include: {
      _count: { select: { guests: true, missions: true, submissions: true, scoreEntries: true } },
      submissions: {
        select: {
          weddingId: true,
          organizationId: true,
          guest: { select: { weddingId: true, organizationId: true } },
          mission: { select: { weddingId: true, organizationId: true } },
        },
      },
      photos: {
        select: {
          guestId: true,
          missionId: true,
          weddingId: true,
          organizationId: true,
          guest: { select: { id: true, weddingId: true, organizationId: true } },
          mission: { select: { id: true, weddingId: true, organizationId: true } },
          submission: { select: { guestId: true, missionId: true, weddingId: true, organizationId: true } },
        },
      },
      scoreEntries: {
        select: {
          guestId: true,
          missionId: true,
          weddingId: true,
          organizationId: true,
          guest: { select: { weddingId: true, organizationId: true } },
          mission: { select: { weddingId: true, organizationId: true } },
          submission: { select: { guestId: true, missionId: true, weddingId: true, organizationId: true } },
        },
      },
    },
  });

  if (weddings.length !== 2) {
    throw new Error("Os dois casamentos fictícios não foram encontrados.");
  }

  const hasCrossWeddingData = weddings.some((wedding) => {
    const invalidSubmission = wedding.submissions.some(
      (submission) =>
        submission.weddingId !== wedding.id ||
        submission.guest.weddingId !== wedding.id ||
        submission.mission.weddingId !== wedding.id ||
        submission.organizationId !== wedding.organizationId ||
        submission.guest.organizationId !== wedding.organizationId ||
        submission.mission.organizationId !== wedding.organizationId,
    );
    const invalidPhoto = wedding.photos.some(
      (photo) =>
        photo.weddingId !== wedding.id ||
        photo.submission.weddingId !== wedding.id ||
        photo.guest.weddingId !== wedding.id ||
        photo.mission.weddingId !== wedding.id ||
        photo.organizationId !== wedding.organizationId ||
        photo.submission.organizationId !== wedding.organizationId ||
        photo.guest.organizationId !== wedding.organizationId ||
        photo.mission.organizationId !== wedding.organizationId ||
        photo.guestId !== photo.submission.guestId ||
        photo.missionId !== photo.submission.missionId,
    );
    const invalidScoreEntry = wedding.scoreEntries.some(
      (entry) =>
        entry.weddingId !== wedding.id ||
        entry.guest.weddingId !== wedding.id ||
        entry.mission.weddingId !== wedding.id ||
        entry.submission.weddingId !== wedding.id ||
        entry.organizationId !== wedding.organizationId ||
        entry.guest.organizationId !== wedding.organizationId ||
        entry.mission.organizationId !== wedding.organizationId ||
        entry.submission.organizationId !== wedding.organizationId ||
        entry.guestId !== entry.submission.guestId ||
        entry.missionId !== entry.submission.missionId,
    );

    return invalidSubmission || invalidPhoto || invalidScoreEntry;
  });

  if (hasCrossWeddingData) {
    throw new Error("Foi detectado um envio associado ao casamento incorreto.");
  }

  for (const wedding of weddings) {
    console.log(
      `${wedding.slug}: ${wedding._count.guests} convidados, ${wedding._count.missions} missões, ${wedding._count.submissions} envios, ${wedding._count.scoreEntries} lançamentos de pontos.`,
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
