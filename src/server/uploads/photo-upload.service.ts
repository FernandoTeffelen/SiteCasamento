import { Prisma, SubmissionStatus } from "@/generated/prisma/client";
import type { ObjectStorage } from "@/lib/storage/types";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import { getGuestContext } from "@/server/guests/guest.service";
import { objectStorage } from "@/server/storage/object-storage";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const DEFAULT_MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

export type UploadPhotoFile = {
  size: number;
  type: string;
  name?: string;
  arrayBuffer(): Promise<ArrayBuffer>;
};

type UploadMissionPhotoInput = {
  eventIdentifier: string;
  guestToken: unknown;
  missionId: unknown;
  clientUploadId: unknown;
  file: UploadPhotoFile;
  storage?: ObjectStorage;
};

function validateGuestToken(guestToken: unknown) {
  if (typeof guestToken !== "string" || guestToken.length < 10 || guestToken.length > 100) {
    throw new DomainError("INVALID_GUEST_TOKEN", 400, "Identificação do convidado inválida.");
  }

  return guestToken;
}

function validateMissionId(missionId: unknown) {
  if (typeof missionId !== "string" || missionId.length < 10 || missionId.length > 100) {
    throw new DomainError("INVALID_MISSION", 400, "Missão inválida.");
  }

  return missionId;
}

function validateClientUploadId(clientUploadId: unknown) {
  if (
    typeof clientUploadId !== "string"
    || clientUploadId.length < 8
    || clientUploadId.length > 100
    || !/^[a-zA-Z0-9_-]+$/.test(clientUploadId)
  ) {
    throw new DomainError("INVALID_UPLOAD_ID", 400, "Identificador da foto inválido.");
  }

  return clientUploadId;
}

function getMaximumUploadBytes() {
  const configuredValue = Number(process.env.MAX_UPLOAD_BYTES ?? DEFAULT_MAX_UPLOAD_BYTES);
  return Number.isInteger(configuredValue) && configuredValue > 0 ? configuredValue : DEFAULT_MAX_UPLOAD_BYTES;
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

function isHeif(bytes: Uint8Array) {
  if (bytes.length < 12 || String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp") return false;
  const brand = String.fromCharCode(...bytes.slice(8, 12)).toLowerCase();
  return ["heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(brand);
}

function isValidImageContent(contentType: string, bytes: Uint8Array) {
  if (contentType === "image/jpeg") return isJpeg(bytes);
  if (contentType === "image/png") return isPng(bytes);
  if (contentType === "image/webp") return isWebp(bytes);
  if (contentType === "image/heic" || contentType === "image/heif") return isHeif(bytes);
  return false;
}

function safeOriginalName(fileName: string | undefined, contentType: string) {
  const fallbackExtension = contentType.split("/")[1] ?? "image";
  const sanitized = fileName?.normalize("NFKD").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return sanitized && sanitized.length > 0 ? sanitized : `foto.${fallbackExtension}`;
}

async function validatePhotoFile(file: UploadPhotoFile) {
  const contentType = file.type.toLowerCase().trim();
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new DomainError("UNSUPPORTED_PHOTO_FORMAT", 415, "Envie uma foto em JPEG, PNG, WebP ou HEIC.");
  }

  if (!Number.isSafeInteger(file.size) || file.size < 1) {
    throw new DomainError("INVALID_PHOTO", 400, "A foto está vazia ou é inválida.");
  }

  if (file.size > getMaximumUploadBytes()) {
    throw new DomainError("PHOTO_TOO_LARGE", 413, "A foto excede o tamanho máximo permitido de 15 MB.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.byteLength !== file.size || !isValidImageContent(contentType, bytes)) {
    throw new DomainError("INVALID_PHOTO_CONTENT", 415, "O arquivo não corresponde a uma imagem válida.");
  }

  return { bytes, contentType, originalName: safeOriginalName(file.name, contentType) };
}

function shouldRetryTransaction(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
}

async function withTransactionRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (shouldRetryTransaction(error) && attempt < 2) continue;
      throw error;
    }
  }

  throw new DomainError("UPLOAD_RETRY_EXHAUSTED", 409, "Não foi possível confirmar o envio. Tente novamente.");
}

function buildStorageKey(weddingId: string, guestId: string, missionId: string, submissionId: string) {
  return `weddings/${weddingId}/guests/${guestId}/missions/${missionId}/${submissionId}/original`;
}

type PreparedSubmission = {
  id: string;
  alreadyUploaded: boolean;
};

async function prepareSubmission(input: {
  weddingId: string;
  guestId: string;
  missionId: string;
  clientUploadId: string;
}) : Promise<PreparedSubmission> {
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const mission = await transaction.mission.findFirst({
      where: { id: input.missionId, weddingId: input.weddingId, active: true },
      select: { id: true, maxSubmissions: true },
    });
    if (!mission) throw new DomainError("MISSION_NOT_FOUND", 404, "Missão não encontrada neste casamento.");

    const existing = await transaction.submission.findFirst({
      where: { weddingId: input.weddingId, clientUploadId: input.clientUploadId },
      select: { id: true, guestId: true, missionId: true, status: true },
    });

    if (existing) {
      if (existing.guestId !== input.guestId || existing.missionId !== input.missionId) {
        throw new DomainError("UPLOAD_ID_CONFLICT", 409, "Esta foto já pertence a outro envio.");
      }
      if (existing.status === SubmissionStatus.UPLOADED) return { id: existing.id, alreadyUploaded: true };
      if (existing.status === SubmissionStatus.UPLOADING) {
        throw new DomainError("UPLOAD_IN_PROGRESS", 409, "Esta foto já está sendo enviada.");
      }

      await transaction.submission.update({
        where: { id: existing.id },
        data: { status: SubmissionStatus.UPLOADING },
      });
      return { id: existing.id, alreadyUploaded: false };
    }

    // Compatibilidade com envios criados pela versão anterior, que registrava
    // a missão sem clientUploadId nem arquivo. Reaproveitar esse registro evita
    // duplicar pontos quando o convidado atualizar o navegador.
    const legacySubmission = await transaction.submission.findFirst({
      where: {
        weddingId: input.weddingId,
        guestId: input.guestId,
        missionId: input.missionId,
        clientUploadId: null,
        status: { in: [SubmissionStatus.PENDING, SubmissionStatus.FAILED] },
      },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (legacySubmission) {
      await transaction.submission.update({
        where: { id: legacySubmission.id },
        data: { clientUploadId: input.clientUploadId, status: SubmissionStatus.UPLOADING },
      });
      return { id: legacySubmission.id, alreadyUploaded: false };
    }

    const activeSubmissionCount = await transaction.submission.count({
      where: {
        weddingId: input.weddingId,
        guestId: input.guestId,
        missionId: input.missionId,
        status: { not: SubmissionStatus.FAILED },
      },
    });
    if (mission.maxSubmissions !== null && activeSubmissionCount >= mission.maxSubmissions) {
      throw new DomainError("MISSION_LIMIT_REACHED", 409, "O limite de fotos desta missão foi atingido.");
    }

    const sequenceCount = await transaction.submission.count({
      where: { weddingId: input.weddingId, guestId: input.guestId, missionId: input.missionId },
    });
    const submission = await transaction.submission.create({
      data: {
        weddingId: input.weddingId,
        guestId: input.guestId,
        missionId: input.missionId,
        clientUploadId: input.clientUploadId,
        sequence: sequenceCount + 1,
        status: SubmissionStatus.PENDING,
      },
      select: { id: true },
    });
    await transaction.submission.update({
      where: { id: submission.id },
      data: { status: SubmissionStatus.UPLOADING },
    });
    return { id: submission.id, alreadyUploaded: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

async function markUploadFailed(submissionId: string) {
  await prisma.submission.updateMany({
    where: { id: submissionId, status: { not: SubmissionStatus.UPLOADED } },
    data: { status: SubmissionStatus.FAILED },
  }).catch(() => undefined);
}

async function finalizeSubmission(input: {
  weddingId: string;
  guestId: string;
  missionId: string;
  submissionId: string;
  contentType: string;
  originalName: string;
  sizeBytes: number;
}) {
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const submission = await transaction.submission.findFirst({
      where: { id: input.submissionId, weddingId: input.weddingId, guestId: input.guestId, missionId: input.missionId },
      select: { id: true, status: true, scoreAwarded: true },
    });
    if (!submission) throw new DomainError("SUBMISSION_NOT_FOUND", 404, "Envio não encontrado neste casamento.");

    const storageKey = buildStorageKey(input.weddingId, input.guestId, input.missionId, input.submissionId);
    await transaction.photo.upsert({
      where: { submissionId: input.submissionId },
      create: {
        weddingId: input.weddingId,
        submissionId: input.submissionId,
        storageKey,
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
      update: {
        originalName: input.originalName,
        contentType: input.contentType,
        sizeBytes: input.sizeBytes,
      },
    });

    if (submission.status === SubmissionStatus.UPLOADED) {
      const guest = await transaction.guest.findUniqueOrThrow({ where: { id: input.guestId }, select: { score: true } });
      return { submissionId: submission.id, awardedNow: false, score: guest.score, alreadyUploaded: true };
    }

    const mission = await transaction.mission.findFirst({
      where: { id: input.missionId, weddingId: input.weddingId },
      select: { points: true, title: true },
    });
    if (!mission) throw new DomainError("MISSION_NOT_FOUND", 404, "Missão não encontrada neste casamento.");

    const existingScoreEntry = await transaction.scoreEntry.findUnique({
      where: { guestId_missionId: { guestId: input.guestId, missionId: input.missionId } },
      select: { id: true },
    });
    const awardedNow = !existingScoreEntry;
    await transaction.submission.update({
      where: { id: input.submissionId },
      data: { status: SubmissionStatus.UPLOADED, scoreAwarded: awardedNow ? mission.points : 0 },
    });

    if (!awardedNow) {
      const guest = await transaction.guest.findUniqueOrThrow({ where: { id: input.guestId }, select: { score: true } });
      return { submissionId: submission.id, awardedNow: false, score: guest.score, alreadyUploaded: false, missionTitle: mission.title };
    }

    await transaction.scoreEntry.create({
      data: {
        weddingId: input.weddingId,
        guestId: input.guestId,
        missionId: input.missionId,
        submissionId: input.submissionId,
        points: mission.points,
      },
    });
    const guest = await transaction.guest.update({
      where: { id: input.guestId },
      data: { score: { increment: mission.points } },
      select: { score: true },
    });
    return { submissionId: submission.id, awardedNow: true, score: guest.score, alreadyUploaded: false, missionTitle: mission.title };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/**
 * Recebe uma foto real, persiste no storage e só então concede pontos.
 * clientUploadId torna as tentativas seguras quando o navegador perde a resposta.
 */
export async function uploadMissionPhoto(input: UploadMissionPhotoInput) {
  const guestToken = validateGuestToken(input.guestToken);
  const missionId = validateMissionId(input.missionId);
  const clientUploadId = validateClientUploadId(input.clientUploadId);
  const photo = await validatePhotoFile(input.file);
  const { wedding, guest } = await getGuestContext(input.eventIdentifier, guestToken);
  const prepared = await prepareSubmission({ weddingId: wedding.id, guestId: guest.id, missionId, clientUploadId });

  if (prepared.alreadyUploaded) {
    const score = await prisma.scoreEntry.aggregate({
      where: { weddingId: wedding.id, guestId: guest.id },
      _sum: { points: true },
    });
    return {
      submission: { id: prepared.id, status: SubmissionStatus.UPLOADED },
      awardedNow: false,
      score: score._sum.points ?? 0,
      alreadyUploaded: true,
    };
  }

  const storageKey = buildStorageKey(wedding.id, guest.id, missionId, prepared.id);
  try {
    await (input.storage ?? objectStorage).put({ storageKey, body: photo.bytes, contentType: photo.contentType });
  } catch {
    await markUploadFailed(prepared.id);
    throw new DomainError("UPLOAD_STORAGE_FAILED", 503, "Não foi possível enviar a foto agora. Tente novamente.");
  }

  try {
    const finalized = await finalizeSubmission({
      weddingId: wedding.id,
      guestId: guest.id,
      missionId,
      submissionId: prepared.id,
      contentType: photo.contentType,
      originalName: photo.originalName,
      sizeBytes: photo.bytes.byteLength,
    });
    return {
      submission: { id: finalized.submissionId, status: SubmissionStatus.UPLOADED },
      awardedNow: finalized.awardedNow,
      score: finalized.score,
      alreadyUploaded: finalized.alreadyUploaded,
    };
  } catch (error) {
    await markUploadFailed(prepared.id);
    throw error;
  }
}

function validateSubmissionId(submissionId: unknown) {
  if (typeof submissionId !== "string" || submissionId.length < 10 || submissionId.length > 100) {
    throw new DomainError("INVALID_SUBMISSION", 400, "Identificador do envio inválido.");
  }
  return submissionId;
}

async function removeGuestSubmission(input: {
  eventIdentifier: string;
  guestToken: unknown;
  missionId: unknown;
  submissionId: string;
  storage?: ObjectStorage;
}) {
  const guestToken = validateGuestToken(input.guestToken);
  const missionId = validateMissionId(input.missionId);
  const submissionId = validateSubmissionId(input.submissionId);
  const { wedding, guest } = await getGuestContext(input.eventIdentifier, guestToken);
  const submission = await prisma.submission.findFirst({
    where: { id: submissionId, weddingId: wedding.id, guestId: guest.id, missionId },
    select: { id: true, photo: { select: { storageKey: true } } },
  });
  if (!submission) {
    throw new DomainError("SUBMISSION_NOT_FOUND", 404, "Foto não encontrada neste casamento.");
  }

  if (submission.photo) {
    try {
      await (input.storage ?? objectStorage).delete(submission.photo.storageKey);
    } catch {
      throw new DomainError("PHOTO_DELETE_FAILED", 503, "Não foi possível excluir a foto agora. Tente novamente.");
    }
  }

  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const current = await transaction.submission.findFirst({
      where: { id: submission.id, weddingId: wedding.id, guestId: guest.id, missionId },
      select: { id: true },
    });
    if (!current) throw new DomainError("SUBMISSION_NOT_FOUND", 404, "Foto não encontrada neste casamento.");

    await transaction.submission.delete({ where: { id: current.id } });
    const remainingPoints = await transaction.scoreEntry.aggregate({
      where: { weddingId: wedding.id, guestId: guest.id },
      _sum: { points: true },
    });
    const score = remainingPoints._sum.points ?? 0;
    await transaction.guest.update({ where: { id: guest.id }, data: { score } });
    return { deletedSubmissionId: current.id, score };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Exclui somente um envio do próprio convidado e recalcula o placar auditável. */
export async function deleteGuestSubmission(input: {
  eventIdentifier: string;
  guestToken: unknown;
  missionId: unknown;
  submissionId: unknown;
  storage?: ObjectStorage;
}) {
  return removeGuestSubmission({
    ...input,
    submissionId: validateSubmissionId(input.submissionId),
  });
}

/**
 * Compatibilidade com a primeira versão, que criou envios PENDING sem
 * clientUploadId. Só considera um envio sem arquivo do próprio convidado.
 */
export async function deleteLegacyGuestSubmission(input: {
  eventIdentifier: string;
  guestToken: unknown;
  missionId: unknown;
  clientUploadId: unknown;
  storage?: ObjectStorage;
}) {
  const guestToken = validateGuestToken(input.guestToken);
  const missionId = validateMissionId(input.missionId);
  const clientUploadId = validateClientUploadId(input.clientUploadId);
  const { wedding, guest } = await getGuestContext(input.eventIdentifier, guestToken);
  const exact = await prisma.submission.findFirst({
    where: { weddingId: wedding.id, guestId: guest.id, missionId, clientUploadId },
    select: { id: true },
  });
  const legacy = exact ?? await prisma.submission.findFirst({
    where: {
      weddingId: wedding.id,
      guestId: guest.id,
      missionId,
      clientUploadId: null,
      status: { in: [SubmissionStatus.PENDING, SubmissionStatus.FAILED] },
      photo: null,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!legacy) throw new DomainError("SUBMISSION_NOT_FOUND", 404, "Foto não encontrada neste casamento.");

  return removeGuestSubmission({
    eventIdentifier: input.eventIdentifier,
    guestToken,
    missionId,
    submissionId: legacy.id,
    storage: input.storage,
  });
}
