import { Prisma, SubmissionStatus } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import { assertWeddingIsActive, findWeddingByIdentifier } from "@/server/events/wedding.service";
import { getGuestContext } from "@/server/guests/guest.service";

export type GuestMission = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  displayOrder: number;
  maxSubmissions: number | null;
  completed: boolean;
  submissionCount: number;
};

function validateGuestToken(guestToken: unknown) {
  if (typeof guestToken !== "string" || guestToken.length < 10 || guestToken.length > 100) {
    throw new DomainError("INVALID_GUEST_TOKEN", 400, "Identificação do convidado inválida.");
  }

  return guestToken;
}

export async function listGuestMissions(eventIdentifier: string, rawGuestToken: unknown) {
  const guestToken = validateGuestToken(rawGuestToken);
  const { wedding, guest } = await getGuestContext(eventIdentifier, guestToken);

  const [missions, scoreEntries, submissionCounts] = await Promise.all([
    prisma.mission.findMany({
      where: { weddingId: wedding.id, active: true },
      orderBy: { displayOrder: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        points: true,
        displayOrder: true,
        maxSubmissions: true,
      },
    }),
    prisma.scoreEntry.findMany({
      where: { weddingId: wedding.id, guestId: guest.id },
      select: { missionId: true },
    }),
    prisma.submission.groupBy({
      by: ["missionId"],
      where: { weddingId: wedding.id, guestId: guest.id },
      _count: { _all: true },
    }),
  ]);

  const completedMissionIds = new Set(scoreEntries.map((entry) => entry.missionId));
  const submissionCountByMission = new Map(
    submissionCounts.map((entry) => [entry.missionId, entry._count._all]),
  );

  const result: GuestMission[] = missions.map((mission) => ({
    ...mission,
    completed: completedMissionIds.has(mission.id),
    submissionCount: submissionCountByMission.get(mission.id) ?? 0,
  }));

  return { wedding, guest, missions: result };
}

export async function getGuestScore(eventIdentifier: string, rawGuestToken: unknown) {
  const guestToken = validateGuestToken(rawGuestToken);
  const { wedding, guest } = await getGuestContext(eventIdentifier, guestToken);
  const aggregate = await prisma.scoreEntry.aggregate({
    where: { weddingId: wedding.id, guestId: guest.id },
    _sum: { points: true },
  });
  const score = aggregate._sum.points ?? 0;

  return {
    wedding,
    guest: { id: guest.id, name: guest.name, token: guest.token },
    score,
  };
}

export async function getEventRanking(eventIdentifier: string, rawLimit?: string | null) {
  const wedding = await findWeddingByIdentifier(eventIdentifier);
  assertWeddingIsActive(wedding);
  const requestedLimit = Number(rawLimit ?? 20);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 20;
  const guests = await prisma.guest.findMany({
    where: { weddingId: wedding.id },
    orderBy: [{ score: "desc" }, { createdAt: "asc" }],
    take: limit,
    select: { id: true, name: true, score: true },
  });

  return {
    wedding,
    ranking: guests.map((guest, index) => ({ position: index + 1, ...guest })),
  };
}

function validateMissionId(missionId: unknown) {
  if (typeof missionId !== "string" || missionId.length < 10 || missionId.length > 100) {
    throw new DomainError("INVALID_MISSION", 400, "Missão inválida.");
  }

  return missionId;
}

function shouldRetryTransaction(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
}

export async function registerMissionCompletion(
  eventIdentifier: string,
  rawGuestToken: unknown,
  rawMissionId: unknown,
) {
  const guestToken = validateGuestToken(rawGuestToken);
  const missionId = validateMissionId(rawMissionId);
  const { wedding, guest } = await getGuestContext(eventIdentifier, guestToken);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (transaction) => {
        const mission = await transaction.mission.findFirst({
          where: { id: missionId, weddingId: wedding.id, active: true },
          select: { id: true, title: true, points: true, maxSubmissions: true },
        });

        if (!mission) {
          throw new DomainError("MISSION_NOT_FOUND", 404, "Missão não encontrada neste casamento.");
        }

        const submissionCount = await transaction.submission.count({
          where: { weddingId: wedding.id, guestId: guest.id, missionId: mission.id },
        });

        if (mission.maxSubmissions !== null && submissionCount >= mission.maxSubmissions) {
          throw new DomainError("MISSION_LIMIT_REACHED", 409, "O limite de fotos desta missão foi atingido.");
        }

        const existingScoreEntry = await transaction.scoreEntry.findUnique({
          where: { guestId_missionId: { guestId: guest.id, missionId: mission.id } },
          select: { id: true },
        });
        const awardedNow = !existingScoreEntry;
        const submission = await transaction.submission.create({
          data: {
            weddingId: wedding.id,
            guestId: guest.id,
            missionId: mission.id,
            sequence: submissionCount + 1,
            // A foto continuará pendente até a futura etapa de upload real.
            status: SubmissionStatus.PENDING,
            scoreAwarded: awardedNow ? mission.points : 0,
          },
          select: { id: true, status: true, sequence: true, scoreAwarded: true },
        });

        if (!awardedNow) {
          const currentGuest = await transaction.guest.findUniqueOrThrow({
            where: { id: guest.id },
            select: { score: true },
          });

          return {
            wedding,
            mission: { id: mission.id, title: mission.title },
            submission,
            awardedNow: false,
            score: currentGuest.score,
          };
        }

        await transaction.scoreEntry.create({
          data: {
            weddingId: wedding.id,
            guestId: guest.id,
            missionId: mission.id,
            submissionId: submission.id,
            points: mission.points,
          },
        });
        const updatedGuest = await transaction.guest.update({
          where: { id: guest.id },
          data: { score: { increment: mission.points } },
          select: { score: true },
        });

        return {
          wedding,
          mission: { id: mission.id, title: mission.title },
          submission,
          awardedNow: true,
          score: updatedGuest.score,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (shouldRetryTransaction(error) && attempt < 2) continue;
      throw error;
    }
  }

  throw new DomainError("COMPLETION_RETRY_EXHAUSTED", 409, "Não foi possível registrar a missão. Tente novamente.");
}
