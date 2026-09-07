import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  CommercialAddOnKind,
  PrismaClient,
  SubmissionStatus,
  SubscriptionPeriod,
  SubscriptionTier,
  WeddingStatus,
  WeddingTemplateTier,
} from "../src/generated/prisma/client";
import { defaultWeddingVisualConfig } from "../src/lib/templates/wedding-visual-config";
import { DEMO_ADMIN_PASSWORD, DEMO_CREDIT_BALANCE, setAdminPassword } from "../src/server/auth/admin-auth.service";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL não foi configurada.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const samplePublicIds = [
  "ana-e-joao",
  "beatriz-e-rafael",
  "evt_4a6f3b9c8d1e2f705a6b7c8d9e0f1a2b",
  "evt_9b2c7d4e1f6a8c305d7e9b2a4c6f8d10",
  "evt_demo_ana_joao_4f2h7k",
  "evt_demo_beatriz_rafael_9m3q6s",
];
const sampleSlugs = ["ana-e-joao", "beatriz-e-rafael"];
const sampleOrganizationPublicId = "org_demo_cerimonial_4f2h7k";
const demoPublicAccessStartsAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
const demoPublicAccessEndsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

async function seedAnaAndJoao(organizationId: string, templateId: string) {
  const wedding = await prisma.wedding.create({
    data: {
      organizationId,
      templateId,
      publicId: "evt_4a6f3b9c8d1e2f705a6b7c8d9e0f1a2b",
      slug: "ana-e-joao",
      name: "Casamento de Ana & João",
      brideName: "Ana",
      groomName: "João",
      eventDate: new Date("2026-10-18T18:00:00.000Z"),
      status: WeddingStatus.ACTIVE,
      publicAccessStartsAt: demoPublicAccessStartsAt,
      publicAccessEndsAt: demoPublicAccessEndsAt,
    },
  });

  const [dancing, friendship, toast] = await Promise.all([
    prisma.mission.create({
      data: {
        organizationId,
        weddingId: wedding.id,
        title: "Os noivos dançando",
        description: "Registre um momento especial na pista de dança.",
        points: 100,
        displayOrder: 1,
      },
    }),
    prisma.mission.create({
      data: {
        organizationId,
        weddingId: wedding.id,
        title: "Uma nova amizade",
        description: "Tire uma selfie com alguém que você acabou de conhecer.",
        points: 80,
        displayOrder: 2,
      },
    }),
    prisma.mission.create({
      data: {
        organizationId,
        weddingId: wedding.id,
        title: "Hora do brinde",
        description: "Fotografe as taças erguidas para celebrar o casal.",
        points: 70,
        displayOrder: 3,
      },
    }),
  ]);

  const [mariana, carlos] = await Promise.all([
    prisma.guest.create({ data: { organizationId, weddingId: wedding.id, name: "Mariana", score: 100 } }),
    prisma.guest.create({ data: { organizationId, weddingId: wedding.id, name: "Carlos", score: 80 } }),
  ]);

  const marianaSubmission = await prisma.submission.create({
    data: {
      organizationId,
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
      organizationId,
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
        organizationId,
        weddingId: wedding.id,
        guestId: mariana.id,
        missionId: dancing.id,
        submissionId: marianaSubmission.id,
        points: dancing.points,
      },
      {
        organizationId,
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

async function seedBeatrizAndRafael(organizationId: string, templateId: string) {
  const wedding = await prisma.wedding.create({
    data: {
      organizationId,
      templateId,
      publicId: "evt_9b2c7d4e1f6a8c305d7e9b2a4c6f8d10",
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
        organizationId,
        weddingId: wedding.id,
        title: "O primeiro beijo",
        description: "Capture o beijo dos noivos após a cerimônia.",
        points: 150,
        displayOrder: 1,
      },
    }),
    prisma.mission.create({
      data: {
        organizationId,
        weddingId: wedding.id,
        title: "A pista animada",
        description: "Mostre a energia de quem está dançando.",
        points: 90,
        displayOrder: 2,
      },
    }),
    prisma.mission.create({
      data: {
        organizationId,
        weddingId: wedding.id,
        title: "Detalhes da mesa",
        description: "Registre um detalhe bonito da decoração.",
        points: 60,
        displayOrder: 3,
      },
    }),
  ]);

  const [fernanda, lucas] = await Promise.all([
    prisma.guest.create({ data: { organizationId, weddingId: wedding.id, name: "Fernanda", score: 150 } }),
    prisma.guest.create({ data: { organizationId, weddingId: wedding.id, name: "Lucas", score: 90 } }),
  ]);

  const fernandaSubmission = await prisma.submission.create({
    data: {
      organizationId,
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
      organizationId,
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
        organizationId,
        weddingId: wedding.id,
        guestId: fernanda.id,
        missionId: firstKiss.id,
        submissionId: fernandaSubmission.id,
        points: firstKiss.points,
      },
      {
        organizationId,
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

  const organization = await prisma.organization.upsert({
    where: { publicId: sampleOrganizationPublicId },
    create: { publicId: sampleOrganizationPublicId, name: "Cerimonial Demonstração" },
    update: { name: "Cerimonial Demonstração" },
  });
  await prisma.organizationCreditBalance.upsert({
    where: { organizationId: organization.id },
    create: { organizationId: organization.id, balance: DEMO_CREDIT_BALANCE },
    update: { balance: DEMO_CREDIT_BALANCE },
  });

  const demoUser = await prisma.user.upsert({
    where: { email: "cerimonial@demo.test" },
    create: {
      email: "cerimonial@demo.test",
      name: "Cerimonialista Demo",
      platformRole: "USER",
    },
    update: {
      name: "Cerimonialista Demo",
    },
  });
  await prisma.organizationMembership.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId: demoUser.id,
      },
    },
    create: {
      organizationId: organization.id,
      userId: demoUser.id,
      role: "OWNER",
    },
    update: {
      role: "OWNER",
    },
  });
  await setAdminPassword({ userId: demoUser.id, password: DEMO_ADMIN_PASSWORD });

  const classicTemplate = await prisma.weddingTemplate.upsert({
    where: { slug: "romance-classico" },
    create: {
      slug: "romance-classico",
      name: "Romance clássico",
      description: "Leve, romântico e pronto para começar.",
      tier: WeddingTemplateTier.FREE,
      thumbnailUrl: "/templates/romance-classico-thumb.svg",
      previewUrl: "/templates/romance-classico-preview.svg",
      defaultConfig: defaultWeddingVisualConfig,
    },
    update: {
      name: "Romance clássico",
      description: "Leve, romântico e pronto para começar.",
      thumbnailUrl: "/templates/romance-classico-thumb.svg",
      previewUrl: "/templates/romance-classico-preview.svg",
      defaultConfig: defaultWeddingVisualConfig,
      active: true,
    },
  });
  const premiumTemplate = await prisma.weddingTemplate.upsert({
    where: { slug: "jardim-ao-entardecer" },
    create: {
      slug: "jardim-ao-entardecer",
      name: "Jardim ao entardecer",
      description: "Uma composição botânica de edição Premium.",
      tier: WeddingTemplateTier.PREMIUM,
      thumbnailUrl: "/templates/jardim-ao-entardecer-thumb.svg",
      previewUrl: "/templates/jardim-ao-entardecer-preview.svg",
      defaultConfig: {
        ...defaultWeddingVisualConfig,
        colors: {
          ...defaultWeddingVisualConfig.colors,
          background: "#f5f3e8",
          primary: "#536b4e",
          accent: "#a87945",
          text: "#28372a",
          mutedText: "#657064",
        },
        fonts: { heading: "serif", body: "modern" },
      },
    },
    update: { active: true },
  });

  const subscriptionTiers = [
    { tier: SubscriptionTier.STARTER, name: "Starter", creditsPerMonth: 3 },
    { tier: SubscriptionTier.PRO, name: "Pro", creditsPerMonth: 6 },
    { tier: SubscriptionTier.AGENCY, name: "Agency", creditsPerMonth: 10 },
  ];
  const subscriptionPeriods = [
    { period: SubscriptionPeriod.MONTHLY, name: "mensal", cycleMonths: 1 },
    { period: SubscriptionPeriod.QUARTERLY, name: "trimestral", cycleMonths: 3 },
    { period: SubscriptionPeriod.SEMIANNUAL, name: "semestral", cycleMonths: 6 },
    { period: SubscriptionPeriod.ANNUAL, name: "anual", cycleMonths: 12 },
  ];
  await Promise.all(subscriptionTiers.flatMap((tier) => subscriptionPeriods.map((period) => (
    prisma.subscriptionPlan.upsert({
      where: { tier_period: { tier: tier.tier, period: period.period } },
      create: {
        slug: `${tier.tier.toLowerCase()}-${period.name}`,
        name: `${tier.name} ${period.name}`,
        tier: tier.tier,
        period: period.period,
        creditsPerMonth: tier.creditsPerMonth,
        creditsPerCycle: tier.creditsPerMonth * period.cycleMonths,
        cycleMonths: period.cycleMonths,
      },
      update: {
        name: `${tier.name} ${period.name}`,
        creditsPerMonth: tier.creditsPerMonth,
        creditsPerCycle: tier.creditsPerMonth * period.cycleMonths,
        cycleMonths: period.cycleMonths,
        active: true,
      },
    })
  ))));
  await Promise.all([3, 6, 10].map((credits) => prisma.creditPackage.upsert({
    where: { slug: `${credits}-creditos` },
    create: { slug: `${credits}-creditos`, name: `${credits} créditos avulsos`, credits },
    update: { name: `${credits} créditos avulsos`, credits, active: true },
  })));
  await Promise.all([
    prisma.commercialAddOn.upsert({
      where: { slug: "template-jardim-ao-entardecer" },
      create: {
        slug: "template-jardim-ao-entardecer",
        name: "Template Jardim ao entardecer",
        kind: CommercialAddOnKind.PREMIUM_TEMPLATE,
        templateId: premiumTemplate.id,
      },
      update: { active: true },
    }),
    prisma.commercialAddOn.upsert({
      where: { slug: "white-label" },
      create: { slug: "white-label", name: "White Label", kind: CommercialAddOnKind.WHITE_LABEL },
      update: { active: true },
    }),
    prisma.commercialAddOn.upsert({
      where: { slug: "servico-adicional" },
      create: { slug: "servico-adicional", name: "Serviço adicional", kind: CommercialAddOnKind.ADDITIONAL_SERVICE },
      update: { active: true },
    }),
  ]);

  const [ana, beatriz] = await Promise.all([
    seedAnaAndJoao(organization.id, classicTemplate.id),
    seedBeatrizAndRafael(organization.id, classicTemplate.id),
  ]);
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
