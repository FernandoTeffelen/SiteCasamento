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
