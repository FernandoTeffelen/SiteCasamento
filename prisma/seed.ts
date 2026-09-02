import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, SubmissionStatus, WeddingStatus } from "../src/generated/prisma/client";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const samplePublicIds = [
  "ana-e-joao",
  "beatriz-e-rafael",
  "evt_demo_ana_joao_4f2h7k",
  "evt_demo_beatriz_rafael_9m3q6s",
];
const sampleSlugs = ["ana-e-joao", "beatriz-e-rafael"];

async function seedAnaAndJoao() {
  const wedding = await prisma.wedding.create({
    data: {
      publicId: "ana-e-joao",
      slug: "ana-e-joao",
      name: "Casamento de Ana & João",
      brideName: "Ana",
      groomName: "João",
      eventDate: new Date("2026-10-18T18:00:00.000Z"),
      status: WeddingStatus.ACTIVE,
    },
  });

  const [dancing, friendship, toast] = await Promise.all([
    prisma.mission.create({
      data: {
        weddingId: wedding.id,
        title: "Os noivos dançando",
        description: "Registre um momento especial na pista de dança.",
        points: 100,
        displayOrder: 1,
      },
    }),
    prisma.mission.create({
      data: {
        weddingId: wedding.id,
        title: "Uma nova amizade",
        description: "Tire uma selfie com alguém que você acabou de conhecer.",
        points: 80,
        displayOrder: 2,
      },
    }),
    prisma.mission.create({
      data: {
        weddingId: wedding.id,
        title: "Hora do brinde",
        description: "Fotografe as taças erguidas para celebrar o casal.",
        points: 70,
        displayOrder: 3,
      },
    }),
  ]);

  const [mariana, carlos] = await Promise.all([
    prisma.guest.create({ data: { weddingId: wedding.id, name: "Mariana", score: 100 } }),
    prisma.guest.create({ data: { weddingId: wedding.id, name: "Carlos", score: 80 } }),
  ]);

  const marianaSubmission = await prisma.submission.create({
    data: {
      weddingId: wedding.id,
      guestId: mariana.id,
      missionId: dancing.id,
      status: SubmissionStatus.UPLOADED,
      scoreAwarded: dancing.points,
      photo: {
        create: {
          storageKey: "demo/ana-e-joao/mariana/noivos-dancando.jpg",
          originalName: "noivos-dancando.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1_024_000,
        },
      },
    },
  });

  const carlosSubmission = await prisma.submission.create({
    data: {
      weddingId: wedding.id,
      guestId: carlos.id,
      missionId: friendship.id,
      status: SubmissionStatus.UPLOADED,
      scoreAwarded: friendship.points,
      photo: {
        create: {
          storageKey: "demo/ana-e-joao/carlos/nova-amizade.jpg",
          originalName: "nova-amizade.jpg",
          contentType: "image/jpeg",
          sizeBytes: 980_000,
        },
      },
    },
  });

  await prisma.scoreEntry.createMany({
    data: [
      {
        weddingId: wedding.id,
        guestId: mariana.id,
        missionId: dancing.id,
        submissionId: marianaSubmission.id,
        points: dancing.points,
      },
      {
        weddingId: wedding.id,
        guestId: carlos.id,
        missionId: friendship.id,
        submissionId: carlosSubmission.id,
        points: friendship.points,
      },
    ],
  });

  return { wedding, toast };
}

async function seedBeatrizAndRafael() {
  const wedding = await prisma.wedding.create({
    data: {
      publicId: "beatriz-e-rafael",
      slug: "beatriz-e-rafael",
      name: "Casamento de Beatriz & Rafael",
      brideName: "Beatriz",
      groomName: "Rafael",
      eventDate: new Date("2026-11-07T19:00:00.000Z"),
      status: WeddingStatus.DRAFT,
    },
  });

  const [firstKiss, danceFloor, tableDetails] = await Promise.all([
    prisma.mission.create({
      data: {
        weddingId: wedding.id,
        title: "O primeiro beijo",
        description: "Capture o beijo dos noivos após a cerimônia.",
        points: 150,
        displayOrder: 1,
      },
    }),
    prisma.mission.create({
      data: {
        weddingId: wedding.id,
        title: "A pista animada",
        description: "Mostre a energia de quem está dançando.",
        points: 90,
        displayOrder: 2,
      },
    }),
    prisma.mission.create({
      data: {
        weddingId: wedding.id,
        title: "Detalhes da mesa",
        description: "Registre um detalhe bonito da decoração.",
        points: 60,
        displayOrder: 3,
      },
    }),
  ]);

  const [fernanda, lucas] = await Promise.all([
    prisma.guest.create({ data: { weddingId: wedding.id, name: "Fernanda", score: 150 } }),
    prisma.guest.create({ data: { weddingId: wedding.id, name: "Lucas", score: 90 } }),
  ]);

  const fernandaSubmission = await prisma.submission.create({
    data: {
      weddingId: wedding.id,
      guestId: fernanda.id,
      missionId: firstKiss.id,
      status: SubmissionStatus.UPLOADED,
      scoreAwarded: firstKiss.points,
      photo: {
        create: {
          storageKey: "demo/beatriz-e-rafael/fernanda/primeiro-beijo.jpg",
          originalName: "primeiro-beijo.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1_140_000,
        },
      },
    },
  });

  const lucasSubmission = await prisma.submission.create({
    data: {
      weddingId: wedding.id,
      guestId: lucas.id,
      missionId: danceFloor.id,
      status: SubmissionStatus.UPLOADED,
      scoreAwarded: danceFloor.points,
      photo: {
        create: {
          storageKey: "demo/beatriz-e-rafael/lucas/pista-animada.jpg",
          originalName: "pista-animada.jpg",
          contentType: "image/jpeg",
          sizeBytes: 1_075_000,
        },
      },
    },
  });

  await prisma.scoreEntry.createMany({
    data: [
      {
        weddingId: wedding.id,
        guestId: fernanda.id,
        missionId: firstKiss.id,
        submissionId: fernandaSubmission.id,
        points: firstKiss.points,
      },
      {
        weddingId: wedding.id,
        guestId: lucas.id,
        missionId: danceFloor.id,
        submissionId: lucasSubmission.id,
        points: danceFloor.points,
      },
    ],
  });

  return { wedding, tableDetails };
}

async function main() {
  // O seed é determinístico e remove apenas os dois eventos fictícios conhecidos.
  await prisma.wedding.deleteMany({
    where: {
      OR: [
        { publicId: { in: samplePublicIds } },
        { slug: { in: sampleSlugs } },
      ],
    },
  });

  const [ana, beatriz] = await Promise.all([seedAnaAndJoao(), seedBeatrizAndRafael()]);
  console.log(`Seed concluído: ${ana.wedding.name} e ${beatriz.wedding.name}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
