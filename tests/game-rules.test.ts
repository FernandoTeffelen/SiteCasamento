import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { SubmissionStatus, WeddingStatus } from "../src/generated/prisma/client";
import type { ObjectStorage } from "../src/lib/storage/types";
import { prisma } from "../src/server/db/prisma";
import { DomainError } from "../src/server/domain/error";
import { findWeddingByIdentifier } from "../src/server/events/wedding.service";
import {
  getEventRanking,
  getGuestScore,
  listGuestMissions,
} from "../src/server/game/game.service";
import { registerOrIdentifyGuest } from "../src/server/guests/guest.service";
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

let eventAId = "";
let eventBId = "";
let missionAId = "";
let missionBId = "";
let guestAToken = "";
let guestAId = "";

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

  getPublicUrl() { return ""; }

  async delete(storageKey: string) {
    this.objects.delete(storageKey);
  }
}

class FailingStorage implements ObjectStorage {
  async put(): Promise<{ storageKey: string }> {
    throw new Error("storage unavailable");
  }

  getPublicUrl() { return ""; }

  async delete() {}
}

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
    name: "Marina",
    guestToken: guestAToken,
  });
  assert.equal(secondAccess.created, false);
  assert.equal(secondAccess.guest.id, guestAId);
  assert.equal(secondAccess.guest.name, "Marina");

  const differentName = await registerOrIdentifyGuest(eventASlug, {
    name: "Outro convidado",
    guestToken: guestAToken,
  });
  assert.equal(differentName.created, true);
  assert.notEqual(differentName.guest.token, guestAToken);

  const accessToOtherEvent = await registerOrIdentifyGuest(eventBSlug, {
    name: "Marina",
    guestToken: guestAToken,
  });
  assert.equal(accessToOtherEvent.created, true);
  assert.equal(accessToOtherEvent.guest.weddingId, eventBId);
  assert.notEqual(accessToOtherEvent.guest.token, guestAToken);
});

test("calcula pontos no servidor somente uma vez por missão enviada", async () => {
  const storage = new MemoryStorage();
  const firstCompletion = await uploadMissionPhoto({
    eventIdentifier: eventASlug,
    guestToken: guestAToken,
    missionId: missionAId,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile(),
    storage,
  });
  assert.equal(firstCompletion.awardedNow, true);
  assert.equal(firstCompletion.submission.status, SubmissionStatus.UPLOADED);
  assert.equal(firstCompletion.score, 110);

  const repeatedCompletion = await uploadMissionPhoto({
    eventIdentifier: eventASlug,
    guestToken: guestAToken,
    missionId: missionAId,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile("segunda-foto.jpg"),
    storage,
  });
  assert.equal(repeatedCompletion.awardedNow, false);
  assert.equal(repeatedCompletion.submission.status, SubmissionStatus.UPLOADED);
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
    () => uploadMissionPhoto({
      eventIdentifier: eventASlug,
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
  const rankingA = await getEventRanking(eventASlug);
  assert.equal(rankingA.ranking.some((guest) => guest.id === guestAId && guest.score === 110), true);

  const rankingB = await getEventRanking(eventBSlug);
  assert.equal(rankingB.ranking.some((guest) => guest.id === guestAId), false);
});

test("marca o envio como falho e permite reenviar a mesma foto sem perdê-la", async () => {
  const guest = await prisma.guest.create({ data: { weddingId: eventAId, name: "Convidada do reenvio" } });
  const mission = await prisma.mission.create({
    data: { weddingId: eventAId, title: "Missão de reenvio", points: 70, displayOrder: 2 },
  });
  const uploadId = `upload-${crypto.randomUUID()}`;

  await assert.rejects(
    () => uploadMissionPhoto({
      eventIdentifier: eventASlug,
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
    eventIdentifier: eventASlug,
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
  const guest = await prisma.guest.create({ data: { weddingId: eventAId, name: "Convidado idempotente" } });
  const mission = await prisma.mission.create({
    data: { weddingId: eventAId, title: "Missão idempotente", points: 130, displayOrder: 3 },
  });
  const storage = new MemoryStorage();
  const uploadId = `upload-${crypto.randomUUID()}`;
  const input = {
    eventIdentifier: eventASlug,
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
  const guest = await prisma.guest.create({ data: { weddingId: eventAId, name: "Convidada de validação" } });
  const mission = await prisma.mission.create({
    data: { weddingId: eventAId, title: "Missão de validação", points: 10, displayOrder: 4 },
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
      eventIdentifier: eventASlug,
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
  const guest = await prisma.guest.create({ data: { weddingId: eventAId, name: "Convidado que exclui" } });
  const mission = await prisma.mission.create({
    data: { weddingId: eventAId, title: "Missão para excluir", points: 55, displayOrder: 5 },
  });
  const storage = new MemoryStorage();
  const upload = await uploadMissionPhoto({
    eventIdentifier: eventASlug,
    guestToken: guest.token,
    missionId: mission.id,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    file: createJpegFile(),
    storage,
  });

  const deleted = await deleteGuestSubmission({
    eventIdentifier: eventASlug,
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
  const guest = await prisma.guest.create({ data: { weddingId: eventAId, name: "Convidado legado", score: 25 } });
  const mission = await prisma.mission.create({
    data: { weddingId: eventAId, title: "Missão legada", points: 25, displayOrder: 6 },
  });
  const legacySubmission = await prisma.submission.create({
    data: {
      weddingId: eventAId,
      guestId: guest.id,
      missionId: mission.id,
      status: SubmissionStatus.PENDING,
      scoreAwarded: 25,
    },
  });
  await prisma.scoreEntry.create({
    data: {
      weddingId: eventAId,
      guestId: guest.id,
      missionId: mission.id,
      submissionId: legacySubmission.id,
      points: 25,
    },
  });

  const deleted = await deleteLegacyGuestSubmission({
    eventIdentifier: eventASlug,
    guestToken: guest.token,
    missionId: mission.id,
    clientUploadId: `upload-${crypto.randomUUID()}`,
    storage: new MemoryStorage(),
  });
  assert.equal(deleted.score, 0);
  assert.equal(await prisma.submission.count({ where: { id: legacySubmission.id } }), 0);
});
