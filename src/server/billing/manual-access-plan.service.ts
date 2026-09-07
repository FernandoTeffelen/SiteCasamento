import {
  CreditLedgerEntryType,
  ManualAccessPlanStatus,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

type Transaction = Prisma.TransactionClient;

function dateOnly(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseStartDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainError("INVALID_MANUAL_PLAN_START_DATE", 400, "Informe uma data de início válida.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new DomainError("INVALID_MANUAL_PLAN_START_DATE", 400, "Informe uma data de início válida.");
  }
  return date;
}

function parsePositiveInteger(value: unknown, code: string, message: string, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new DomainError(code, 400, message);
  }
  return parsed;
}

function parsePlanStatus(value: unknown) {
  if (Object.values(ManualAccessPlanStatus).includes(value as ManualAccessPlanStatus)) {
    return value as ManualAccessPlanStatus;
  }
  throw new DomainError("INVALID_MANUAL_PLAN_STATUS", 400, "Status do plano inválido.");
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function calculateManualPlanEndDate(startDate: Date, durationMonths: number) {
  const exclusiveEnd = addMonths(startDate, durationMonths);
  exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() - 1);
  return exclusiveEnd;
}

function manualPlanCycleKey(planId: string, cycleIndex: number) {
  return `manual-access-plan:${planId}:cycle:${cycleIndex}`;
}

async function reconcilePlansInTransaction(transaction: Transaction, organizationId: string, now: Date) {
  const today = dateOnly(now);
  const plans = await transaction.manualAccessPlan.findMany({
    where: { organizationId, status: ManualAccessPlanStatus.ACTIVE },
    select: {
      id: true,
      creditsPerMonth: true,
      durationMonths: true,
      startDate: true,
      endDate: true,
      lastCreditReleasedAt: true,
      nextCreditReleaseAt: true,
    },
  });

  let grantedCredits = 0;
  for (const plan of plans) {
    if (today > dateOnly(plan.endDate)) {
      await transaction.manualAccessPlan.update({
        where: { id: plan.id },
        data: { status: ManualAccessPlanStatus.EXPIRED, nextCreditReleaseAt: null },
      });
      continue;
    }

    let lastCreditReleasedAt: Date | null = null;
    let nextCreditReleaseAt: Date | null = null;
    for (let cycleIndex = 0; cycleIndex < plan.durationMonths; cycleIndex += 1) {
      const cycleStart = addMonths(plan.startDate, cycleIndex);
      const idempotencyKey = manualPlanCycleKey(plan.id, cycleIndex);
      const existing = await transaction.creditLedgerEntry.findFirst({
        where: { organizationId, idempotencyKey },
        select: { id: true },
      });
      if (existing) {
        lastCreditReleasedAt = cycleStart;
        continue;
      }
      if (cycleStart > today) {
        nextCreditReleaseAt = cycleStart;
        break;
      }

      const balance = await transaction.organizationCreditBalance.upsert({
        where: { organizationId },
        create: { organizationId, balance: plan.creditsPerMonth },
        update: { balance: { increment: plan.creditsPerMonth } },
        select: { balance: true },
      });
      await transaction.creditLedgerEntry.create({
        data: {
          organizationId,
          type: CreditLedgerEntryType.ADJUSTMENT,
          delta: plan.creditsPerMonth,
          balanceAfter: balance.balance,
          idempotencyKey,
          description: `Créditos do ciclo ${cycleIndex + 1} do plano manual.`,
        },
      });
      grantedCredits += plan.creditsPerMonth;
      lastCreditReleasedAt = cycleStart;
    }

    if (
      plan.lastCreditReleasedAt?.getTime() !== lastCreditReleasedAt?.getTime()
      || plan.nextCreditReleaseAt?.getTime() !== nextCreditReleaseAt?.getTime()
    ) {
      await transaction.manualAccessPlan.update({
        where: { id: plan.id },
        data: { lastCreditReleasedAt, nextCreditReleaseAt },
      });
    }
  }
  return { grantedCredits };
}

function isRetryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
}

async function withTransactionRetry<T>(operation: () => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (isRetryableTransactionError(error) && attempt < 2) continue;
      throw error;
    }
  }
  throw new DomainError("MANUAL_PLAN_RETRY_EXHAUSTED", 409, "Não foi possível confirmar o plano manual.");
}

export async function reconcileManualAccessPlansForOrganizations(organizationIds: string[], now = new Date()) {
  if (!organizationIds.length) return;
  await Promise.all(organizationIds.map((organizationId) => withTransactionRetry(() => prisma.$transaction(
    (transaction) => reconcilePlansInTransaction(transaction, organizationId, now),
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  ))));
}

export async function createManualAccessPlan(input: {
  customerId: string;
  organizationId: string;
  createdByUserId: string;
  durationMonths: unknown;
  creditsPerMonth: unknown;
  startDate: unknown;
  status: unknown;
  adjustmentMode?: unknown;
}) {
  const durationMonths = parsePositiveInteger(input.durationMonths, "INVALID_MANUAL_PLAN_DURATION", "A duração deve ter entre 1 e 36 meses.", 36);
  const creditsPerMonth = parsePositiveInteger(input.creditsPerMonth, "INVALID_MANUAL_PLAN_CREDITS", "Informe entre 1 e 1.000 créditos por mês.", 1_000);
  const startDate = parseStartDate(input.startDate);
  const endDate = calculateManualPlanEndDate(startDate, durationMonths);
  const status = parsePlanStatus(input.status);
  const adjustmentMode = input.adjustmentMode === "INCREASE_CREDITS" ? "INCREASE_CREDITS" : "EXTEND";

  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: input.organizationId, userId: input.customerId } },
      select: { organizationId: true },
    });
    if (!membership) throw new DomainError("CUSTOMER_ORGANIZATION_NOT_FOUND", 404, "A organização não pertence a este cliente.");

    if (status === ManualAccessPlanStatus.ACTIVE || status === ManualAccessPlanStatus.PENDING_PAYMENT) {
      const overlap = await transaction.manualAccessPlan.findFirst({
        where: {
          organizationId: input.organizationId,
          status: { in: [ManualAccessPlanStatus.ACTIVE, ManualAccessPlanStatus.PENDING_PAYMENT] },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { id: true, status: true },
      });
      if (overlap) {
        if (status !== ManualAccessPlanStatus.ACTIVE || overlap.status !== ManualAccessPlanStatus.ACTIVE) {
          throw new DomainError("MANUAL_PLAN_OVERLAP", 409, "Já existe um plano ativo ou aguardando pagamento neste período.");
        }

        const current = await transaction.manualAccessPlan.findUniqueOrThrow({
          where: { id: overlap.id },
          select: { id: true, startDate: true, durationMonths: true, creditsPerMonth: true, nextCreditReleaseAt: true },
        });
        if (adjustmentMode === "EXTEND") {
          const duration = current.durationMonths + durationMonths;
          return transaction.manualAccessPlan.update({
            where: { id: current.id },
            data: {
              durationMonths: duration,
              endDate: calculateManualPlanEndDate(current.startDate, duration),
              nextCreditReleaseAt: current.nextCreditReleaseAt ?? addMonths(current.startDate, current.durationMonths),
            },
          });
        }

        const nextCredits = current.creditsPerMonth + creditsPerMonth;
        const updated = await transaction.manualAccessPlan.update({
          where: { id: current.id },
          data: { creditsPerMonth: nextCredits },
        });
        const adjustmentKey = `manual-access-plan:${current.id}:credits:${nextCredits}`;
        const existingAdjustment = await transaction.creditLedgerEntry.findFirst({
          where: { organizationId: input.organizationId, idempotencyKey: adjustmentKey },
          select: { id: true },
        });
        if (!existingAdjustment) {
          const balance = await transaction.organizationCreditBalance.upsert({
            where: { organizationId: input.organizationId },
            create: { organizationId: input.organizationId, balance: creditsPerMonth },
            update: { balance: { increment: creditsPerMonth } },
            select: { balance: true },
          });
          await transaction.creditLedgerEntry.create({
            data: {
              organizationId: input.organizationId,
              type: CreditLedgerEntryType.ADJUSTMENT,
              delta: creditsPerMonth,
              balanceAfter: balance.balance,
              idempotencyKey: adjustmentKey,
              description: `Ajuste manual: +${creditsPerMonth} crédito(s) por mês.`,
            },
          });
        }
        return updated;
      }
    }

    const plan = await transaction.manualAccessPlan.create({
      data: {
        organizationId: input.organizationId,
        customerId: input.customerId,
        createdByUserId: input.createdByUserId,
        durationMonths,
        creditsPerMonth,
        startDate,
        endDate,
        status,
        canceledAt: status === ManualAccessPlanStatus.CANCELED ? new Date() : null,
      },
    });
    if (status === ManualAccessPlanStatus.ACTIVE) {
      await reconcilePlansInTransaction(transaction, input.organizationId, new Date());
    }
    return plan;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function updateManualAccessPlanStatus(input: {
  customerId: string;
  planId: string;
  status: unknown;
}) {
  const status = parsePlanStatus(input.status);
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const plan = await transaction.manualAccessPlan.findFirst({
      where: { id: input.planId, customerId: input.customerId },
      select: { id: true, organizationId: true, startDate: true, endDate: true, status: true },
    });
    if (!plan) throw new DomainError("MANUAL_PLAN_NOT_FOUND", 404, "Plano manual não encontrado.");

    if (status === ManualAccessPlanStatus.ACTIVE && plan.status !== ManualAccessPlanStatus.ACTIVE) {
      const overlap = await transaction.manualAccessPlan.findFirst({
        where: {
          id: { not: plan.id },
          organizationId: plan.organizationId,
          status: { in: [ManualAccessPlanStatus.ACTIVE, ManualAccessPlanStatus.PENDING_PAYMENT] },
          startDate: { lte: plan.endDate },
          endDate: { gte: plan.startDate },
        },
        select: { id: true },
      });
      if (overlap) throw new DomainError("MANUAL_PLAN_OVERLAP", 409, "Já existe outro plano ativo ou pendente neste período.");
    }

    const updated = await transaction.manualAccessPlan.update({
      where: { id: plan.id },
      data: {
        status,
        canceledAt: status === ManualAccessPlanStatus.CANCELED ? new Date() : null,
        nextCreditReleaseAt: status === ManualAccessPlanStatus.ACTIVE ? undefined : null,
      },
    });
    if (status === ManualAccessPlanStatus.ACTIVE) {
      await reconcilePlansInTransaction(transaction, plan.organizationId, new Date());
    }
    return updated;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}
