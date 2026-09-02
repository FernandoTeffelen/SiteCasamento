import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { WeddingStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/server/db/prisma";
import { DomainError } from "../src/server/domain/error";
import { findWeddingByIdentifier } from "../src/server/events/wedding.service";
import {
  getEventRanking,
  getGuestScore,
  listGuestMissions,
  registerMissionCompletion,
} from "../src/server/game/game.service";
import { registerOrIdentifyGuest } from "../src/server/guests/guest.service";

const testSuffix = crypto.randomUUID();
const eventAToken = `evt_test_a_${testSuffix}`;
const eventASlug = `test-a-${testSuffix}`;
const eventBToken = `evt_test_b_${testSuffix}`;
const eventBSlug = `test-b-${testSuffix}`;

let eventAId = "";
let eventBId = "";
let missionAId = "";
let missionBId = "";
let guestAToken = "";
let guestAId = "";

before(async () => {
  const [eventA, eventB] = await Promise.all([
    prisma.wedding.create({
      data: {
        publicId: eventAToken,
        slug: eventASlug,
        name: "Evento de teste A",
        brideName: "Aline",
        groomName: "Bruno",
        status: WeddingStatus.ACTIVE,
      },
    }),
    prisma.wedding.create({
      data: {
        publicId: eventBToken,
        slug: eventBSlug,
        name: "Evento de teste B",
        brideName: "Clara",
        groomName: "Diego",
        status: WeddingStatus.ACTIVE,
      },
    }),
  ]);
  eventAId = eventA.id;
  eventBId = eventB.id;

  const [missionA, missionB] = await Promise.all([
    prisma.mission.create({
      data: { weddingId: eventA.id, title: "Missão A", points: 110, displayOrder: 1 },
    }),
    prisma.mission.create({
      data: { weddingId: eventB.id, title: "Missão B", points: 90, displayOrder: 1 },
    }),
  ]);
  missionAId = missionA.id;
  missionBId = missionB.id;
});

after(async () => {
  await prisma.wedding.deleteMany({ where: { id: { in: [eventAId, eventBId] } } });
  await prisma.$disconnect();
});

test("localiza o mesmo casamento por slug e token público", async () => {
  const [bySlug, byToken] = await Promise.all([
    findWeddingByIdentifier(eventASlug),
    findWeddingByIdentifier(eventAToken),
  ]);

  assert.equal(bySlug.id, eventAId);
  assert.equal(byToken.id, eventAId);
});

test("identifica o convidado apenas dentro do próprio casamento", async () => {
  const firstAccess = await registerOrIdentifyGuest(eventASlug, { name: "Marina" });
  guestAToken = firstAccess.guest.token;
  guestAId = firstAccess.guest.id;
  assert.equal(firstAccess.created, true);

  const secondAccess = await registerOrIdentifyGuest(eventASlug, {
    name: "Outro nome ignorado",
    guestToken: guestAToken,
  });
  assert.equal(secondAccess.created, false);
  assert.equal(secondAccess.guest.id, guestAId);
  assert.equal(secondAccess.guest.name, "Marina");

  const accessToOtherEvent = await registerOrIdentifyGuest(eventBSlug, {
    name: "Marina",
    guestToken: guestAToken,
  });
  assert.equal(accessToOtherEvent.created, true);
  assert.equal(accessToOtherEvent.guest.weddingId, eventBId);
  assert.notEqual(accessToOtherEvent.guest.token, guestAToken);
});

test("calcula pontos no servidor somente uma vez por missão", async () => {
  const firstCompletion = await registerMissionCompletion(eventASlug, guestAToken, missionAId);
  assert.equal(firstCompletion.awardedNow, true);
  assert.equal(firstCompletion.submission.scoreAwarded, 110);
  assert.equal(firstCompletion.score, 110);

  const repeatedCompletion = await registerMissionCompletion(eventASlug, guestAToken, missionAId);
  assert.equal(repeatedCompletion.awardedNow, false);
  assert.equal(repeatedCompletion.submission.scoreAwarded, 0);
  assert.equal(repeatedCompletion.score, 110);

  const score = await getGuestScore(eventASlug, guestAToken);
  assert.equal(score.score, 110);
});

test("lista somente missões do casamento e bloqueia missão de outro evento", async () => {
  const missions = await listGuestMissions(eventASlug, guestAToken);
  assert.equal(missions.missions.length, 1);
  assert.equal(missions.missions[0]?.id, missionAId);
  assert.equal(missions.missions[0]?.completed, true);
  assert.equal(missions.missions[0]?.submissionCount, 2);

  await assert.rejects(
    () => registerMissionCompletion(eventASlug, guestAToken, missionBId),
    (error: unknown) => error instanceof DomainError && error.code === "MISSION_NOT_FOUND",
  );
});

test("ranking contém somente convidados do evento consultado", async () => {
  const rankingA = await getEventRanking(eventASlug);
  assert.equal(rankingA.ranking.length, 1);
  assert.equal(rankingA.ranking[0]?.id, guestAId);
  assert.equal(rankingA.ranking[0]?.score, 110);

  const rankingB = await getEventRanking(eventBSlug);
  assert.equal(rankingB.ranking.some((guest) => guest.id === guestAId), false);
});
