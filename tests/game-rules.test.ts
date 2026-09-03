import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import {
  OrganizationRole,
  PhotoModerationStatus,
  Prisma,
  ScoreEntrySource,
  SubscriptionPeriod,
  SubscriptionTier,
  SubmissionStatus,
  WeddingStatus,
  WeddingTemplateTier,
} from "../src/generated/prisma/client";
import type { ObjectStorage } from "../src/lib/storage/types";
import { prisma } from "../src/server/db/prisma";
import { DomainError } from "../src/server/domain/error";
import {
  findWeddingByIdentifier,
  findWeddingByPublicAccessToken,
  generateSecureWeddingToken,
  restoreWeddingPublicAccess,
  revokeWeddingPublicAccess,
  rotateWeddingPublicToken,
} from "../src/server/events/wedding.service";
import { getActiveEventView } from "../src/server/events/event-view.service";
import { findWeddingForOrganizationUser } from "../src/server/organizations/organization-access.service";
import {
  authenticateAdmin,
  getAdminSessionFromToken,
  revokeAdminSession,
  setAdminPassword,
} from "../src/server/auth/admin-auth.service";
import {
  activateOrganizationSubscription,
  activateWeddingWithCredit,
  completeOneTimeCreditPurchase,
  createOneTimeCreditPurchase,
  createOrganizationSubscription,
  getOrganizationCreditBalance,
  grantOrganizationSubscriptionCycle,
} from "../src/server/billing/credit.service";
import {
  assignWeddingTemplate,
  getWeddingVisualConfig,
  listWeddingTemplates,
  updateWeddingCustomization,
} from "../src/server/templates/wedding-template.service";
import {
  getEventRanking,
  getGuestScore,
  listGuestMissions,
} from "../src/server/game/game.service";
import { getGuestAvatar, registerOrIdentifyGuest, updateGuestProfile } from "../src/server/guests/guest.service";
import {
  deleteLegacyGuestSubmission,
  deleteGuestSubmission,
  uploadMissionPhoto,
  type UploadPhotoFile,
} from "../src/server/uploads/photo-upload.service";

const testSuffix = crypto.randomUUID();
const eventAToken = `evt_test_a_${testSuffix}`;
const eventASlug = `test-a-${testSuffix}`;
const eventBToken = `evt_test_b_${testSuffix}`;
const eventBSlug = `test-b-${testSuffix}`;
const testPublicAccessStartsAt = new Date("2020-01-01T00:00:00.000Z");
const testPublicAccessEndsAt = new Date("2035-01-01T00:00:00.000Z");

let eventAId = "";
let eventBId = "";
let organizationAId = "";
let organizationBId = "";
let userAId = "";
let userBId = "";
let missionAId = "";
let missionBId = "";
let guestAToken = "";
let guestAId = "";
let freeTemplateId = "";
let premiumTemplateId = "";
let subscriptionPlanId = "";
let creditPackageId = "";

const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);

function createJpegFile(name = "foto.jpg"): UploadPhotoFile {
  return {
    name,
    type: "image/jpeg",
    size: jpegBytes.byteLength,
    async arrayBuffer() {
      return jpegBytes.slice().buffer;
    },
  };
}

class MemoryStorage implements ObjectStorage {
  readonly objects = new Map<string, Uint8Array>();

  async put(input: { storageKey: string; body: Uint8Array }) {
    this.objects.set(input.storageKey, input.body);
    return { storageKey: input.storageKey };
  }

  async get(storageKey: string) {
    const body = this.objects.get(storageKey);
    if (!body) throw new Error("object not found");
    return { body, contentType: "image/jpeg" };
  }

  getPublicUrl() { return ""; }

  async delete(storageKey: string) {
    this.objects.delete(storageKey);
  }
}

class FailingStorage implements ObjectStorage {
  async put(): Promise<{ storageKey: string }> {
    throw new Error("storage unavailable");
  }

  async get(): Promise<never> {
    throw new Error("storage unavailable");
  }

  getPublicUrl() { return ""; }

  async delete() {}
}

before(async () => {
  const [freeTemplate, premiumTemplate] = await Promise.all([
    prisma.weddingTemplate.create({
      data: {
        slug: `free-template-${testSuffix}`,
        name: "Template gratuito de teste",
        tier: WeddingTemplateTier.FREE,
        defaultConfig: { colors: { primary: "#a95954" } },
      },
    }),
    prisma.weddingTemplate.create({
      data: {
        slug: `premium-template-${testSuffix}`,
        name: "Template Premium de teste",
        tier: WeddingTemplateTier.PREMIUM,
        thumbnailUrl: "/templates/premium-thumb.svg",
        previewUrl: "/templates/premium-preview.svg",
        defaultConfig: { colors: { primary: "#345678" }, fonts: { heading: "modern" } },
      },
    }),
  ]);
  freeTemplateId = freeTemplate.id;
  premiumTemplateId = premiumTemplate.id;

  const [subscriptionPlan, creditPackage] = await Promise.all([
    prisma.subscriptionPlan.upsert({
      where: { tier_period: { tier: SubscriptionTier.STARTER, period: SubscriptionPeriod.QUARTERLY } },
      create: {
        slug: `starter-quarterly-${testSuffix}`,
        name: "Starter trimestral de teste",
        tier: SubscriptionTier.STARTER,
        period: SubscriptionPeriod.QUARTERLY,
        creditsPerMonth: 3,
        creditsPerCycle: 9,
        cycleMonths: 3,
      },
      update: {},
    }),
    prisma.creditPackage.create({
      data: { slug: `credits-five-${testSuffix}`, name: "5 créditos de teste", credits: 5 },
    }),
  ]);
  subscriptionPlanId = subscriptionPlan.id;
  creditPackageId = creditPackage.id;

  const [organizationA, organizationB] = await Promise.all([
    prisma.organization.create({ data: { name: "Cerimonial A" } }),
    prisma.organization.create({ data: { name: "Cerimonial B" } }),
  ]);
  organizationAId = organizationA.id;
  organizationBId = organizationB.id;

  const [userA, userB] = await Promise.all([
    prisma.user.create({ data: { email: `owner-a-${testSuffix}@example.test`, name: "Responsável A" } }),
    prisma.user.create({ data: { email: `owner-b-${testSuffix}@example.test`, name: "Responsável B" } }),
  ]);
  userAId = userA.id;
  userBId = userB.id;
  await prisma.organizationMembership.createMany({
    data: [
      { organizationId: organizationAId, userId: userAId, role: OrganizationRole.OWNER },
      { organizationId: organizationBId, userId: userBId, role: OrganizationRole.OWNER },
    ],
  });

  const [eventA, eventB] = await Promise.all([
    prisma.wedding.create({
      data: {
        organizationId: organizationAId,
        publicId: eventAToken,
        slug: eventASlug,
        name: "Evento de teste A",
        brideName: "Aline",
        groomName: "Bruno",
        status: WeddingStatus.ACTIVE,
        publicAccessStartsAt: testPublicAccessStartsAt,
        publicAccessEndsAt: testPublicAccessEndsAt,
      },
    }),
    prisma.wedding.create({
      data: {
        organizationId: organizationBId,
        publicId: eventBToken,
        slug: eventBSlug,
        name: "Evento de teste B",
        brideName: "Clara",
        groomName: "Diego",
        status: WeddingStatus.ACTIVE,
        publicAccessStartsAt: testPublicAccessStartsAt,
        publicAccessEndsAt: testPublicAccessEndsAt,
      },
    }),
  ]);
  eventAId = eventA.id;
  eventBId = eventB.id;

  const [missionA, missionB] = await Promise.all([
    prisma.mission.create({
      data: { organizationId: organizationAId, weddingId: eventA.id, title: "Missão A", points: 110, displayOrder: 1 },
    }),
    prisma.mission.create({
      data: { organizationId: organizationBId, weddingId: eventB.id, title: "Missão B", points: 90, displayOrder: 1 },
    }),
  ]);
  missionAId = missionA.id;
  missionBId = missionB.id;
});

after(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [organizationAId, organizationBId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
  await prisma.creditPackage.deleteMany({ where: { id: creditPackageId } });
  await prisma.weddingTemplate.deleteMany({ where: { id: { in: [freeTemplateId, premiumTemplateId] } } });
  await prisma.$disconnect();
});

test("localiza o mesmo casamento por slug e token público", async () => {
  const [bySlug, byToken] = await Promise.all([
    findWeddingByIdentifier(eventASlug),
    findWeddingByIdentifier(eventAToken),
  ]);

  assert.equal(bySlug.id, eventAId);
  assert.equal(byToken.id, eventAId);

  const publicEvent = await getActiveEventView(eventAToken);
  assert.equal(publicEvent.publicPath, `/w/${eventAToken}`);
  await assert.rejects(
    () => getActiveEventView(eventASlug),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_NOT_FOUND",
  );
});

test("janela pública expirada bloqueia convidados sem apagar o casamento", async () => {
  const expiredWedding = await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: `expired-event-${testSuffix}`,
      name: "Evento expirado",
      brideName: "Lia",
      groomName: "Marcos",
      status: WeddingStatus.ACTIVE,
      publicAccessStartsAt: new Date("2020-01-01T00:00:00.000Z"),
      publicAccessEndsAt: new Date("2020-01-02T00:00:00.000Z"),
    },
  });
  await assert.rejects(
    () => getActiveEventView(expiredWedding.publicId),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_UNAVAILABLE",
  );
  assert.equal((await prisma.wedding.findUniqueOrThrow({ where: { id: expiredWedding.id } })).id, expiredWedding.id);
});

test("login administrativo usa senha com hash e sessão opaca revogável", async () => {
  await setAdminPassword({ userId: userAId, password: "senha-de-teste-segura-123" });
  const userRecord = await prisma.user.findUniqueOrThrow({ where: { id: userAId }, select: { passwordHash: true } });
  assert.notEqual(userRecord.passwordHash, "senha-de-teste-segura-123");
  await assert.rejects(
    () => authenticateAdmin({ email: `owner-a-${testSuffix}@example.test`, password: "senha-incorreta" }),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_CREDENTIALS",
  );
  const session = await authenticateAdmin({ email: `owner-a-${testSuffix}@example.test`, password: "senha-de-teste-segura-123" });
  assert.equal((await getAdminSessionFromToken(session.token))?.id, userAId);
  await revokeAdminSession(session.token);
  assert.equal(await getAdminSessionFromToken(session.token), null);
});

test("usuários administrativos só resolvem casamentos da própria organização", async () => {
  const ownWedding = await findWeddingForOrganizationUser({
    userId: userAId,
    organizationId: organizationAId,
    weddingId: eventAId,
  });
  assert.equal(ownWedding.id, eventAId);

  await assert.rejects(
    () => findWeddingForOrganizationUser({
      userId: userAId,
      organizationId: organizationBId,
      weddingId: eventBId,
    }),
    (error: unknown) => error instanceof DomainError && error.code === "ORGANIZATION_ACCESS_DENIED",
  );
});

test("créditos comerciais são auditáveis, recorrentes e consumidos uma única vez na ativação", async () => {
  const subscription = await createOrganizationSubscription({
    organizationId: organizationAId,
    planId: subscriptionPlanId,
  });
  const firstCycleStart = new Date("2030-01-01T00:00:00.000Z");
  const firstGrant = await activateOrganizationSubscription({
    organizationId: organizationAId,
    subscriptionId: subscription.id,
    cycleStart: firstCycleStart,
  });
  assert.equal(firstGrant.grantedNow, true);
  assert.equal(firstGrant.balance, 9);

  const repeatedCycle = await activateOrganizationSubscription({
    organizationId: organizationAId,
    subscriptionId: subscription.id,
    cycleStart: firstCycleStart,
  });
  assert.equal(repeatedCycle.grantedNow, false);
  assert.equal(repeatedCycle.balance, 9);

  const nextCycle = await grantOrganizationSubscriptionCycle({
    organizationId: organizationAId,
    subscriptionId: subscription.id,
    cycleStart: new Date("2030-04-01T00:00:00.000Z"),
  });
  assert.equal(nextCycle.grantedNow, true);
  assert.equal(nextCycle.balance, 18);

  const purchase = await createOneTimeCreditPurchase({
    organizationId: organizationAId,
    creditPackageId,
    idempotencyKey: `purchase-${testSuffix}`,
  });
  const duplicatePurchase = await createOneTimeCreditPurchase({
    organizationId: organizationAId,
    creditPackageId,
    idempotencyKey: `purchase-${testSuffix}`,
  });
  assert.equal(purchase.created, true);
  assert.equal(duplicatePurchase.created, false);
  assert.equal(duplicatePurchase.purchase.id, purchase.purchase.id);

  const paidPurchase = await completeOneTimeCreditPurchase({ organizationId: organizationAId, purchaseId: purchase.purchase.id });
  const repeatedPurchase = await completeOneTimeCreditPurchase({ organizationId: organizationAId, purchaseId: purchase.purchase.id });
  assert.equal(paidPurchase.creditedNow, true);
  assert.equal(repeatedPurchase.creditedNow, false);
  assert.equal(repeatedPurchase.balance, 23);

  const creditWedding = await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: `credit-wedding-${testSuffix}`,
      name: "Casamento com crédito",
      brideName: "Gabi",
      groomName: "Hugo",
      status: WeddingStatus.DRAFT,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
    },
  });
  const activation = await activateWeddingWithCredit({ organizationId: organizationAId, weddingId: creditWedding.id });
  const repeatedActivation = await activateWeddingWithCredit({ organizationId: organizationAId, weddingId: creditWedding.id });
  assert.equal(activation.activatedNow, true);
  assert.equal(activation.balance, 22);
  assert.equal(repeatedActivation.activatedNow, false);
  assert.equal(repeatedActivation.balance, 22);
  assert.equal((await prisma.wedding.findUniqueOrThrow({ where: { id: creditWedding.id } })).status, WeddingStatus.ACTIVE);
  assert.equal(await prisma.creditLedgerEntry.count({
    where: { organizationId: organizationAId, weddingId: creditWedding.id, type: "WEDDING_ACTIVATION" },
  }), 1);

  const balance = await getOrganizationCreditBalance(organizationAId);
  assert.equal(balance.balance, 22);
  assert.equal(balance.entries.filter((entry) => entry.delta > 0).length, 3);
  assert.equal(balance.entries.filter((entry) => entry.delta < 0).length, 1);

  await assert.rejects(
    () => activateWeddingWithCredit({ organizationId: organizationBId, weddingId: creditWedding.id }),
    (error: unknown) => error instanceof DomainError && error.code === "WEDDING_NOT_FOUND",
  );

  const noCreditWedding = await prisma.wedding.create({
    data: {
      organizationId: organizationBId,
      publicId: `no-credit-wedding-${testSuffix}`,
      name: "Casamento sem crédito",
      brideName: "Iara",
      groomName: "Jonas",
      status: WeddingStatus.DRAFT,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
    },
  });
  await assert.rejects(
    () => activateWeddingWithCredit({ organizationId: organizationBId, weddingId: noCreditWedding.id }),
    (error: unknown) => error instanceof DomainError && error.code === "INSUFFICIENT_CREDITS",
  );
});

test("reutiliza templates e mantém personalizações isoladas em cada casamento", async () => {
  const catalog = await listWeddingTemplates();
  assert.equal(catalog.some((template) => template.id === freeTemplateId && template.tier === WeddingTemplateTier.FREE), true);
  assert.equal(catalog.some((template) => template.id === premiumTemplateId && template.tier === WeddingTemplateTier.PREMIUM), true);

  await assignWeddingTemplate({ organizationId: organizationAId, weddingId: eventAId, templateId: premiumTemplateId });
  const customizedEventA = await updateWeddingCustomization({
    organizationId: organizationAId,
    weddingId: eventAId,
    overrides: {
      colors: { primary: "#123456" },
      texts: { welcomeTitle: "Bem-vindos ao nosso momento" },
      assets: { logoImageUrl: "/logos/evento-a.svg" },
    },
  });
  assert.equal(customizedEventA.colors.primary, "#123456");
  assert.equal(customizedEventA.fonts.heading, "modern");
  assert.equal(customizedEventA.texts.welcomeTitle, "Bem-vindos ao nosso momento");

  const templateAfterCustomization = await prisma.weddingTemplate.findUniqueOrThrow({
    where: { id: premiumTemplateId },
    select: { defaultConfig: true },
  });
  assert.deepEqual(templateAfterCustomization.defaultConfig, { colors: { primary: "#345678" }, fonts: { heading: "modern" } });

  const eventBVisual = await getWeddingVisualConfig({ organizationId: organizationBId, weddingId: eventBId });
  assert.equal(eventBVisual.colors.primary, "#a95954");
  assert.equal(eventBVisual.texts.welcomeTitle, "Que alegria ter você aqui!");

  await assert.rejects(
    () => updateWeddingCustomization({
      organizationId: organizationAId,
      weddingId: eventBId,
      overrides: { colors: { primary: "#654321" } },
    }),
    (error: unknown) => error instanceof DomainError && error.code === "WEDDING_NOT_FOUND",
  );
});

test("o banco bloqueia vínculos entre organizações e entre casamentos", async () => {
  await assert.rejects(
    () => prisma.guest.create({
      data: { organizationId: organizationAId, weddingId: eventBId, name: "Vínculo inválido" },
    }),
    (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003",
  );

  const otherWeddingInOrganizationA = await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: `evt_test_same_org_${crypto.randomUUID()}`,
      name: "Outro evento da organização A",
      brideName: "Elisa",
      groomName: "Fábio",
      status: WeddingStatus.ACTIVE,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
    },
  });
  const [guestFromEventA, missionFromOtherWedding] = await Promise.all([
    prisma.guest.create({
      data: { organizationId: organizationAId, weddingId: eventAId, name: "Convidado para constraint" },
    }),
    prisma.mission.create({
      data: {
        organizationId: organizationAId,
        weddingId: otherWeddingInOrganizationA.id,
        title: "Missão de outro evento",
        points: 10,
        displayOrder: 1,
      },
    }),
  ]);

  await assert.rejects(
    () => prisma.submission.create({
      data: {
        organizationId: organizationAId,
        weddingId: otherWeddingInOrganizationA.id,
        guestId: guestFromEventA.id,
        missionId: missionFromOtherWedding.id,
      },
    }),
    (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003",
  );

  const [validSubmission, otherGuestFromEventA] = await Promise.all([
    prisma.submission.create({
      data: {
        organizationId: organizationAId,
        weddingId: eventAId,
        guestId: guestFromEventA.id,
        missionId: missionAId,
        clientUploadId: `constraint-upload-${crypto.randomUUID()}`,
        status: SubmissionStatus.UPLOADED,
      },
    }),
    prisma.guest.create({
      data: {
        organizationId: organizationAId,
        weddingId: eventAId,
        name: "Outro convidado para vínculo",
        email: `other-guest-${testSuffix}@example.test`,
      },
    }),
  ]);

  await assert.rejects(
    () => prisma.photo.create({
      data: {
        organizationId: organizationAId,
        weddingId: eventAId,
        guestId: otherGuestFromEventA.id,
        missionId: missionAId,
        submissionId: validSubmission.id,
        storageKey: `invalid-photo-${crypto.randomUUID()}`,
        contentType: "image/jpeg",
        sizeBytes: 12,
      },
    }),
    (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003",
  );

  await assert.rejects(
    () => prisma.scoreEntry.create({
      data: {
        organizationId: organizationAId,
        weddingId: eventAId,
        guestId: otherGuestFromEventA.id,
        missionId: missionAId,
        submissionId: validSubmission.id,
        points: 10,
      },
    }),
    (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003",
  );
});

test("identifica o convidado apenas dentro do próprio casamento", async () => {
  const firstAccess = await registerOrIdentifyGuest(eventAToken, { name: "Marina", email: "marina@example.test" });
  guestAToken = firstAccess.guest.token;
  guestAId = firstAccess.guest.id;
  assert.equal(firstAccess.created, true);

  const secondAccess = await registerOrIdentifyGuest(eventAToken, {
    name: "Marina",
    email: "marina@example.test",
    guestToken: guestAToken,
  });
  assert.equal(secondAccess.created, false);
  assert.equal(secondAccess.guest.id, guestAId);
  assert.equal(secondAccess.guest.name, "Marina");
  assert.equal(secondAccess.guest.email, "marina@example.test");

  const differentName = await registerOrIdentifyGuest(eventAToken, {
    name: "Outro convidado",
    email: "outro-convidado@example.test",
    guestToken: guestAToken,
  });
  assert.equal(differentName.created, true);
  assert.notEqual(differentName.guest.token, guestAToken);

  const accessToOtherEvent = await registerOrIdentifyGuest(eventBToken, {
    name: "Marina",
    email: "marina-evento-b@example.test",
    guestToken: guestAToken,
  });
  assert.equal(accessToOtherEvent.created, true);
  assert.equal(accessToOtherEvent.guest.weddingId, eventBId);
  assert.notEqual(accessToOtherEvent.guest.token, guestAToken);

  await assert.rejects(
    () => registerOrIdentifyGuest(eventAToken, { name: "Outra Marina", email: "marina@example.test" }),
    (error: unknown) => error instanceof DomainError && error.code === "GUEST_EMAIL_IN_USE",
  );
});

test("persiste o perfil opcional no convidado e protege a foto pelo casamento", async () => {
  const storage = new MemoryStorage();
  const firstUpdate = await updateGuestProfile({
    eventIdentifier: eventAToken,
    guestToken: guestAToken,
    name: "Marina",
    age: "28",
    relationshipToCouple: "Amiga da noiva",
    storage,
  });
  assert.equal(firstUpdate.guest.age, 28);
  assert.equal(firstUpdate.guest.relationshipToCouple, "Amiga da noiva");
  assert.equal(firstUpdate.guest.hasAvatar, false);

  const avatarUpdate = await updateGuestProfile({
    eventIdentifier: eventAToken,
    guestToken: guestAToken,
    name: "Marina",
    age: "28",
    relationshipToCouple: "Amiga da noiva",
    avatar: createJpegFile("perfil.jpg"),
    storage,
  });
  assert.equal(avatarUpdate.guest.hasAvatar, true);

  const avatar = await getGuestAvatar({
    eventIdentifier: eventAToken,
    guestToken: guestAToken,
    storage,
  });
  assert.deepEqual(avatar.body, jpegBytes);
  assert.equal(avatar.contentType, "image/jpeg");

  await assert.rejects(
    () => updateGuestProfile({
      eventIdentifier: eventBToken,
      guestToken: guestAToken,
      name: "Marina",
      storage,
    }),
    (error: unknown) => error instanceof DomainError && error.code === "GUEST_NOT_FOUND",
  );
});

test("calcula pontos no servidor somente uma vez por missão enviada", async () => {
  const storage = new MemoryStorage();
  const firstCompletion = await uploadMissionPhoto({
    eventIdentifier: eventAToken,
    guestToken: guestAToken,
    missionId: missionAId,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile(),
    storage,
  });
  assert.equal(firstCompletion.awardedNow, true);
  assert.equal(firstCompletion.submission.status, SubmissionStatus.UPLOADED);
  assert.equal(firstCompletion.score, 110);

  const [photo, history] = await Promise.all([
    prisma.photo.findFirstOrThrow({ where: { submissionId: firstCompletion.submission.id } }),
    prisma.scoreEntry.findFirstOrThrow({ where: { submissionId: firstCompletion.submission.id } }),
  ]);
  assert.equal(photo.guestId, guestAId);
  assert.equal(photo.missionId, missionAId);
  assert.equal(photo.moderationStatus, PhotoModerationStatus.PENDING);
  assert.equal(history.source, ScoreEntrySource.MISSION_COMPLETION);
  assert.equal(history.points, 110);

  const repeatedCompletion = await uploadMissionPhoto({
    eventIdentifier: eventAToken,
    guestToken: guestAToken,
    missionId: missionAId,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile("segunda-foto.jpg"),
    storage,
  });
  assert.equal(repeatedCompletion.awardedNow, false);
  assert.equal(repeatedCompletion.submission.status, SubmissionStatus.UPLOADED);
  assert.equal(repeatedCompletion.score, 110);

  const score = await getGuestScore(eventAToken, guestAToken);
  assert.equal(score.score, 110);
});

test("lista somente missões do casamento e bloqueia missão de outro evento", async () => {
  const missions = await listGuestMissions(eventAToken, guestAToken);
  assert.equal(missions.missions.length, 1);
  assert.equal(missions.missions[0]?.id, missionAId);
  assert.equal(missions.missions[0]?.completed, true);
  assert.equal(missions.missions[0]?.submissionCount, 2);

  await assert.rejects(
    () => uploadMissionPhoto({
      eventIdentifier: eventAToken,
      guestToken: guestAToken,
      missionId: missionBId,
      clientUploadId: `upload-${crypto.randomUUID()}`,
      file: createJpegFile(),
      storage: new MemoryStorage(),
    }),
    (error: unknown) => error instanceof DomainError && error.code === "MISSION_NOT_FOUND",
  );
});

test("ranking contém somente convidados do evento consultado", async () => {
  const rankingA = await getEventRanking(eventAToken);
  assert.equal(rankingA.ranking.some((guest) => guest.id === guestAId && guest.score === 110), true);

  const rankingB = await getEventRanking(eventBToken);
  assert.equal(rankingB.ranking.some((guest) => guest.id === guestAId), false);
});

test("marca o envio como falho e permite reenviar a mesma foto sem perdê-la", async () => {
  const guest = await prisma.guest.create({ data: { organizationId: organizationAId, weddingId: eventAId, name: "Convidada do reenvio" } });
  const mission = await prisma.mission.create({
    data: { organizationId: organizationAId, weddingId: eventAId, title: "Missão de reenvio", points: 70, displayOrder: 2 },
  });
  const uploadId = `upload-${crypto.randomUUID()}`;

  await assert.rejects(
    () => uploadMissionPhoto({
      eventIdentifier: eventAToken,
      guestToken: guest.token,
      missionId: mission.id,
      clientUploadId: uploadId,
      file: createJpegFile(),
      storage: new FailingStorage(),
    }),
    (error: unknown) => error instanceof DomainError && error.code === "UPLOAD_STORAGE_FAILED",
  );

  const failedSubmission = await prisma.submission.findFirstOrThrow({
    where: { weddingId: eventAId, clientUploadId: uploadId },
  });
  assert.equal(failedSubmission.status, SubmissionStatus.FAILED);
  assert.equal(await prisma.photo.count({ where: { submissionId: failedSubmission.id } }), 0);

  const storage = new MemoryStorage();
  const retry = await uploadMissionPhoto({
    eventIdentifier: eventAToken,
    guestToken: guest.token,
    missionId: mission.id,
    clientUploadId: uploadId,
    file: createJpegFile(),
    storage,
  });
  assert.equal(retry.submission.status, SubmissionStatus.UPLOADED);
  assert.equal(retry.awardedNow, true);
  assert.equal(retry.score, 70);
  assert.equal(storage.objects.size, 1);
});

test("um upload repetido é idempotente e não concede pontos duplicados", async () => {
  const guest = await prisma.guest.create({ data: { organizationId: organizationAId, weddingId: eventAId, name: "Convidado idempotente" } });
  const mission = await prisma.mission.create({
    data: { organizationId: organizationAId, weddingId: eventAId, title: "Missão idempotente", points: 130, displayOrder: 3 },
  });
  const storage = new MemoryStorage();
  const uploadId = `upload-${crypto.randomUUID()}`;
  const input = {
    eventIdentifier: eventAToken,
    guestToken: guest.token,
    missionId: mission.id,
    clientUploadId: uploadId,
    file: createJpegFile(),
    storage,
  };

  const firstUpload = await uploadMissionPhoto(input);
  const repeatedUpload = await uploadMissionPhoto(input);

  assert.equal(firstUpload.awardedNow, true);
  assert.equal(repeatedUpload.alreadyUploaded, true);
  assert.equal(repeatedUpload.awardedNow, false);
  assert.equal(repeatedUpload.score, 130);
  assert.equal(await prisma.submission.count({ where: { weddingId: eventAId, clientUploadId: uploadId } }), 1);
  assert.equal(await prisma.photo.count({ where: { weddingId: eventAId, submission: { missionId: mission.id } } }), 1);
  assert.equal(await prisma.scoreEntry.count({ where: { weddingId: eventAId, guestId: guest.id, missionId: mission.id } }), 1);
});

test("rejeita um arquivo que finge ser foto antes de criar um envio", async () => {
  const guest = await prisma.guest.create({ data: { organizationId: organizationAId, weddingId: eventAId, name: "Convidada de validação" } });
  const mission = await prisma.mission.create({
    data: { organizationId: organizationAId, weddingId: eventAId, title: "Missão de validação", points: 10, displayOrder: 4 },
  });
  const uploadId = `upload-${crypto.randomUUID()}`;
  const invalidFile: UploadPhotoFile = {
    name: "nao-e-foto.jpg",
    type: "image/jpeg",
    size: 4,
    async arrayBuffer() { return new Uint8Array([1, 2, 3, 4]).buffer; },
  };

  await assert.rejects(
    () => uploadMissionPhoto({
      eventIdentifier: eventAToken,
      guestToken: guest.token,
      missionId: mission.id,
      clientUploadId: uploadId,
      file: invalidFile,
      storage: new MemoryStorage(),
    }),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_PHOTO_CONTENT",
  );
  assert.equal(await prisma.submission.count({ where: { weddingId: eventAId, clientUploadId: uploadId } }), 0);
});

test("excluir uma foto própria remove o envio e recalcula os pontos", async () => {
  const guest = await prisma.guest.create({ data: { organizationId: organizationAId, weddingId: eventAId, name: "Convidado que exclui" } });
  const mission = await prisma.mission.create({
    data: { organizationId: organizationAId, weddingId: eventAId, title: "Missão para excluir", points: 55, displayOrder: 5 },
  });
  const storage = new MemoryStorage();
  const upload = await uploadMissionPhoto({
    eventIdentifier: eventAToken,
    guestToken: guest.token,
    missionId: mission.id,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile(),
    storage,
  });

  const deleted = await deleteGuestSubmission({
    eventIdentifier: eventAToken,
    guestToken: guest.token,
    missionId: mission.id,
    submissionId: upload.submission.id,
    storage,
  });
  assert.equal(deleted.score, 0);
  assert.equal(await prisma.submission.count({ where: { id: upload.submission.id } }), 0);
  assert.equal(await prisma.scoreEntry.count({ where: { weddingId: eventAId, guestId: guest.id, missionId: mission.id } }), 0);
  assert.equal(storage.objects.size, 0);
});

test("permite limpar registros PENDING da versão anterior ao excluir a foto local", async () => {
  const guest = await prisma.guest.create({ data: { organizationId: organizationAId, weddingId: eventAId, name: "Convidado legado", score: 25 } });
  const mission = await prisma.mission.create({
    data: { organizationId: organizationAId, weddingId: eventAId, title: "Missão legada", points: 25, displayOrder: 6 },
  });
  const legacySubmission = await prisma.submission.create({
    data: {
      organizationId: organizationAId,
      weddingId: eventAId,
      guestId: guest.id,
      missionId: mission.id,
      status: SubmissionStatus.PENDING,
      scoreAwarded: 25,
    },
  });
  await prisma.scoreEntry.create({
    data: {
      organizationId: organizationAId,
      weddingId: eventAId,
      guestId: guest.id,
      missionId: mission.id,
      submissionId: legacySubmission.id,
      points: 25,
    },
  });

  const deleted = await deleteLegacyGuestSubmission({
    eventIdentifier: eventAToken,
    guestToken: guest.token,
    missionId: mission.id,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    storage: new MemoryStorage(),
  });
  assert.equal(deleted.score, 0);
  assert.equal(await prisma.submission.count({ where: { id: legacySubmission.id } }), 0);
});

test("rejeita tokens inválidos, curtos, vazios, não existentes e IDs numéricos sequenciais", async () => {
  // Testes de tokens inválidos e não enumeráveis
  await assert.rejects(
    () => findWeddingByPublicAccessToken(""),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_EVENT_TOKEN",
  );
  await assert.rejects(
    () => findWeddingByPublicAccessToken("123"),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_EVENT_TOKEN",
  );
  await assert.rejects(
    () => findWeddingByPublicAccessToken("1002495817264819"),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_EVENT_TOKEN",
  );
  await assert.rejects(
    () => findWeddingByPublicAccessToken("evt_token_inexistente_1234567890abcdef"),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_NOT_FOUND",
  );

  // Slug legível não é aceito como token público no getActiveEventView
  await assert.rejects(
    () => getActiveEventView(eventASlug),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_NOT_FOUND",
  );
});

test("casamento sem expiração próxima permanece ativo e acessível indefinidamente", async () => {
  const perpetualToken = generateSecureWeddingToken();
  const perpetualWedding = await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: perpetualToken,
      name: "Casamento Sem Expiração Próxima",
      brideName: "Sofia",
      groomName: "Lucas",
      status: WeddingStatus.ACTIVE,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
      publicAccessRevokedAt: null,
    },
  });

  const eventView = await getActiveEventView(perpetualToken);
  assert.equal(eventView.publicId, perpetualToken);
  assert.equal(eventView.brideName, "Sofia");
  assert.equal(eventView.groomName, "Lucas");

  const guestRegistration = await registerOrIdentifyGuest(perpetualToken, {
    name: "Convidado Perpétuo",
    email: `perpetuo-${testSuffix}@example.test`,
  });
  assert.equal(guestRegistration.created, true);
  assert.equal(guestRegistration.wedding.id, perpetualWedding.id);
});

test("bloqueia acesso a casamento com status inativo (DRAFT, CLOSED, ARCHIVED)", async () => {
  const draftToken = generateSecureWeddingToken();
  await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: draftToken,
      name: "Casamento Rascunho",
      brideName: "Julia",
      groomName: "Pedro",
      status: WeddingStatus.DRAFT,
    },
  });

  await assert.rejects(
    () => getActiveEventView(draftToken),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_UNAVAILABLE",
  );

  const closedToken = generateSecureWeddingToken();
  await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: closedToken,
      name: "Casamento Encerrado",
      brideName: "Renata",
      groomName: "Thiago",
      status: WeddingStatus.CLOSED,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
    },
  });

  await assert.rejects(
    () => getActiveEventView(closedToken),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_UNAVAILABLE",
  );
});

test("revogação manual bloqueia acesso público e restauração reativa sem perda de dados", async () => {
  const revocableToken = generateSecureWeddingToken();
  const revocableWedding = await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: revocableToken,
      name: "Casamento Revogável",
      brideName: "Beatriz",
      groomName: "Mateus",
      status: WeddingStatus.ACTIVE,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
    },
  });

  const mission = await prisma.mission.create({
    data: {
      organizationId: organizationAId,
      weddingId: revocableWedding.id,
      title: "Foto dos Noivos",
      points: 100,
      displayOrder: 1,
    },
  });

  const guestAccess = await registerOrIdentifyGuest(revocableToken, {
    name: "Convidada Beatriz",
    email: `beatriz-${testSuffix}@example.test`,
  });

  const storage = new MemoryStorage();
  const photoUpload = await uploadMissionPhoto({
    eventIdentifier: revocableToken,
    guestToken: guestAccess.guest.token,
    missionId: mission.id,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile(),
    storage,
  });
  assert.equal(photoUpload.awardedNow, true);

  // 1. Revogar o acesso público manualmente
  const revokedWedding = await revokeWeddingPublicAccess({
    organizationId: organizationAId,
    weddingId: revocableWedding.id,
  });
  assert.notEqual(revokedWedding.publicAccessRevokedAt, null);

  // 2. Tentar acessar o evento revogado deve falhar
  await assert.rejects(
    () => getActiveEventView(revocableToken),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_UNAVAILABLE",
  );
  await assert.rejects(
    () => listGuestMissions(revocableToken, guestAccess.guest.token),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_UNAVAILABLE",
  );
  await assert.rejects(
    () => getEventRanking(revocableToken),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_UNAVAILABLE",
  );

  // 3. Verificar que os dados continuam intactos no banco de dados
  const preservedWedding = await prisma.wedding.findUniqueOrThrow({ where: { id: revocableWedding.id } });
  const preservedGuest = await prisma.guest.findUniqueOrThrow({ where: { id: guestAccess.guest.id } });
  const preservedPhoto = await prisma.photo.findFirstOrThrow({ where: { weddingId: revocableWedding.id } });
  const preservedScore = await prisma.scoreEntry.findFirstOrThrow({ where: { weddingId: revocableWedding.id } });

  assert.equal(preservedWedding.id, revocableWedding.id);
  assert.equal(preservedGuest.name, "Convidada Beatriz");
  assert.equal(preservedGuest.score, 100);
  assert.equal(preservedPhoto.submissionId, photoUpload.submission.id);
  assert.equal(preservedScore.points, 100);

  // 4. Restaurar o acesso público
  const restoredWedding = await restoreWeddingPublicAccess({
    organizationId: organizationAId,
    weddingId: revocableWedding.id,
  });
  assert.equal(restoredWedding.publicAccessRevokedAt, null);

  // 5. Acesso funciona novamente normalmente
  const activeView = await getActiveEventView(revocableToken);
  assert.equal(activeView.publicId, revocableToken);
  const ranking = await getEventRanking(revocableToken);
  assert.equal(ranking.ranking.length, 1);
  assert.equal(ranking.ranking[0]?.name, "Convidada Beatriz");
});

test("rotação de token gera novo identificador seguro, invalida o antigo e preserva todos os dados", async () => {
  const initialToken = generateSecureWeddingToken();
  const rotatingWedding = await prisma.wedding.create({
    data: {
      organizationId: organizationAId,
      publicId: initialToken,
      name: "Casamento Rotação",
      brideName: "Helena",
      groomName: "Gabriel",
      status: WeddingStatus.ACTIVE,
      publicAccessStartsAt: testPublicAccessStartsAt,
      publicAccessEndsAt: testPublicAccessEndsAt,
    },
  });

  const guest = await registerOrIdentifyGuest(initialToken, {
    name: "Convidado Rotação",
    email: `rotacao-${testSuffix}@example.test`,
  });
  assert.equal(guest.created, true);

  // Rotaciona o token do casamento
  const rotation = await rotateWeddingPublicToken({
    organizationId: organizationAId,
    weddingId: rotatingWedding.id,
  });

  assert.equal(rotation.oldToken, initialToken);
  assert.notEqual(rotation.newToken, initialToken);
  assert.equal(rotation.newToken.startsWith("evt_"), true);
  assert.equal(rotation.wedding.publicId, rotation.newToken);

  // Token antigo deixa de existir/funcionar
  await assert.rejects(
    () => findWeddingByPublicAccessToken(initialToken),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_NOT_FOUND",
  );
  await assert.rejects(
    () => getActiveEventView(initialToken),
    (error: unknown) => error instanceof DomainError && error.code === "EVENT_NOT_FOUND",
  );

  // Novo token funciona perfeitamente com os mesmos convidados e dados
  const viewWithNewToken = await getActiveEventView(rotation.newToken);
  assert.equal(viewWithNewToken.publicId, rotation.newToken);
  assert.equal(viewWithNewToken.brideName, "Helena");

  const identifiedWithNewToken = await registerOrIdentifyGuest(rotation.newToken, {
    name: "Convidado Rotação",
    email: `rotacao-${testSuffix}@example.test`,
    guestToken: guest.guest.token,
  });
  assert.equal(identifiedWithNewToken.created, false);
  assert.equal(identifiedWithNewToken.guest.id, guest.guest.id);
});

test("isolamento estrito entre casamentos impede que convidados acessem ou enviem dados para outro evento", async () => {
  // Convidado A tenta registrar ou acessar missões no evento B
  await assert.rejects(
    () => listGuestMissions(eventBToken, guestAToken),
    (error: unknown) => error instanceof DomainError && error.code === "GUEST_NOT_FOUND",
  );

  await assert.rejects(
    () => getGuestScore(eventBToken, guestAToken),
    (error: unknown) => error instanceof DomainError && error.code === "GUEST_NOT_FOUND",
  );

  // Convidado A tenta enviar foto para missão A usando token do evento B
  await assert.rejects(
    () => uploadMissionPhoto({
      eventIdentifier: eventBToken,
      guestToken: guestAToken,
      missionId: missionAId,
      clientUploadId: `upload-${crypto.randomUUID()}`,
      file: createJpegFile(),
      storage: new MemoryStorage(),
    }),
    (error: unknown) => error instanceof DomainError && error.code === "GUEST_NOT_FOUND",
  );

  // Tentativa de acessar casamento inexistente por ID numérico aleatório
  await assert.rejects(
    () => findWeddingByPublicAccessToken("9876543210123456"),
    (error: unknown) => error instanceof DomainError && error.code === "INVALID_EVENT_TOKEN",
  );
});
