import {
  CreditLedgerEntryType,
  OneTimePurchaseStatus,
  Prisma,
  SubscriptionStatus,
  WeddingStatus,
} from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

type Transaction = Prisma.TransactionClient;

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
  throw new DomainError("BILLING_RETRY_EXHAUSTED", 409, "Não foi possível confirmar os créditos. Tente novamente.");
}

function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}

function subscriptionCycleKey(subscriptionId: string, cycleStart: Date) {
  return `subscription-cycle:${subscriptionId}:${cycleStart.toISOString()}`;
}

async function increaseBalance(transaction: Transaction, organizationId: string, delta: number) {
  return transaction.organizationCreditBalance.upsert({
    where: { organizationId },
    create: { organizationId, balance: delta },
    update: { balance: { increment: delta } },
    select: { balance: true },
  });
}

async function grantSubscriptionCycleInTransaction(input: {
  transaction: Transaction;
  subscription: {
    id: string;
    organizationId: string;
    status: SubscriptionStatus;
    creditsPerCycle: number;
    cycleMonths: number;
    currentPeriodEnd: Date | null;
  };
  cycleStart: Date;
  cycleEnd?: Date;
}) {
  const { transaction, subscription, cycleStart } = input;
  if (subscription.status !== SubscriptionStatus.ACTIVE) {
    throw new DomainError("SUBSCRIPTION_NOT_ACTIVE", 409, "A assinatura não está ativa para liberar créditos.");
  }

  const idempotencyKey = subscriptionCycleKey(subscription.id, cycleStart);
  const existing = await transaction.creditLedgerEntry.findFirst({
    where: { organizationId: subscription.organizationId, idempotencyKey },
    select: { id: true, balanceAfter: true },
  });
  if (existing) return { grantedNow: false, balance: existing.balanceAfter };
  if (
    subscription.currentPeriodEnd
    && subscription.currentPeriodEnd.getTime() !== cycleStart.getTime()
  ) {
    throw new DomainError("SUBSCRIPTION_CYCLE_NOT_DUE", 409, "Este ciclo de assinatura ainda não está disponível.");
  }

  const balance = await increaseBalance(transaction, subscription.organizationId, subscription.creditsPerCycle);
  await transaction.creditLedgerEntry.create({
    data: {
      organizationId: subscription.organizationId,
      subscriptionId: subscription.id,
      type: CreditLedgerEntryType.SUBSCRIPTION_CYCLE,
      delta: subscription.creditsPerCycle,
      balanceAfter: balance.balance,
      idempotencyKey,
      description: "Créditos liberados pelo ciclo da assinatura.",
    },
  });
  await transaction.organizationSubscription.update({
    where: { id: subscription.id },
    data: {
      currentPeriodStart: cycleStart,
      currentPeriodEnd: input.cycleEnd ?? addMonths(cycleStart, subscription.cycleMonths),
    },
  });
  return { grantedNow: true, balance: balance.balance };
}

/** Cria a intenção de uma assinatura. A ativação será chamada pelo gateway futuro. */
export async function createOrganizationSubscription(input: { organizationId: string; planId: string }) {
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { id: input.planId, active: true },
    select: { id: true, tier: true, period: true, creditsPerCycle: true, cycleMonths: true },
  });
  if (!plan) throw new DomainError("SUBSCRIPTION_PLAN_NOT_FOUND", 404, "Plano de assinatura indisponível.");

  const organization = await prisma.organization.findUnique({ where: { id: input.organizationId }, select: { id: true } });
  if (!organization) throw new DomainError("ORGANIZATION_NOT_FOUND", 404, "Organização não encontrada.");

  return prisma.organizationSubscription.create({
    data: {
      organizationId: organization.id,
      planId: plan.id,
      tier: plan.tier,
      period: plan.period,
      creditsPerCycle: plan.creditsPerCycle,
      cycleMonths: plan.cycleMonths,
    },
  });
}

/**
 * Ponto único para uma confirmação de ciclo recorrente. Hoje é chamado somente
 * por código administrativo/testes; futuramente o webhook do gateway o usará.
 */
export async function activateOrganizationSubscription(input: {
  organizationId: string;
  subscriptionId: string;
  cycleStart?: Date;
}) {
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const subscription = await transaction.organizationSubscription.findFirst({
      where: { id: input.subscriptionId, organizationId: input.organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        creditsPerCycle: true,
        cycleMonths: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
      },
    });
    if (!subscription) throw new DomainError("SUBSCRIPTION_NOT_FOUND", 404, "Assinatura não encontrada nesta organização.");
    if (subscription.status === SubscriptionStatus.CANCELED || subscription.status === SubscriptionStatus.EXPIRED) {
      throw new DomainError("SUBSCRIPTION_NOT_AVAILABLE", 409, "Esta assinatura não pode mais ser ativada.");
    }

    const cycleStart = input.cycleStart ?? subscription.currentPeriodStart ?? new Date();
    const activeSubscription = subscription.status === SubscriptionStatus.ACTIVE
      ? subscription
      : await transaction.organizationSubscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.ACTIVE },
        select: {
          id: true,
          organizationId: true,
          status: true,
          creditsPerCycle: true,
          cycleMonths: true,
          currentPeriodEnd: true,
        },
      });

    const grant = await grantSubscriptionCycleInTransaction({
      transaction,
      subscription: activeSubscription,
      cycleStart,
    });
    return { subscriptionId: subscription.id, ...grant };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Idempotente por ciclo, para a rotina recorrente que será agendada no futuro. */
export async function grantOrganizationSubscriptionCycle(input: {
  organizationId: string;
  subscriptionId: string;
  cycleStart: Date;
}) {
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const subscription = await transaction.organizationSubscription.findFirst({
      where: { id: input.subscriptionId, organizationId: input.organizationId },
      select: {
        id: true,
        organizationId: true,
        status: true,
        creditsPerCycle: true,
        cycleMonths: true,
        currentPeriodEnd: true,
      },
    });
    if (!subscription) throw new DomainError("SUBSCRIPTION_NOT_FOUND", 404, "Assinatura não encontrada nesta organização.");
    return grantSubscriptionCycleInTransaction({ transaction, subscription, cycleStart: input.cycleStart });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Registra uma intenção de compra avulsa; não cobra nem concede crédito ainda. */
export async function createOneTimeCreditPurchase(input: {
  organizationId: string;
  creditPackageId: string;
  idempotencyKey: string;
}) {
  if (!input.idempotencyKey || input.idempotencyKey.length > 160) {
    throw new DomainError("INVALID_PURCHASE_KEY", 400, "Identificador da compra inválido.");
  }
  const creditPackage = await prisma.creditPackage.findFirst({
    where: { id: input.creditPackageId, active: true },
    select: { id: true, credits: true, priceCents: true, currency: true },
  });
  if (!creditPackage) throw new DomainError("CREDIT_PACKAGE_NOT_FOUND", 404, "Pacote de créditos indisponível.");

  const existing = await prisma.oneTimePurchase.findFirst({
    where: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey },
  });
  if (existing) return { purchase: existing, created: false };

  try {
    const purchase = await prisma.oneTimePurchase.create({
      data: {
        organizationId: input.organizationId,
        creditPackageId: creditPackage.id,
        credits: creditPackage.credits,
        priceCents: creditPackage.priceCents,
        currency: creditPackage.currency,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return { purchase, created: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const purchase = await prisma.oneTimePurchase.findFirstOrThrow({
        where: { organizationId: input.organizationId, idempotencyKey: input.idempotencyKey },
      });
      return { purchase, created: false };
    }
    throw error;
  }
}

/** Entrada destinada ao webhook futuro: completa uma compra e credita apenas uma vez. */
export async function completeOneTimeCreditPurchase(input: { organizationId: string; purchaseId: string }) {
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const purchase = await transaction.oneTimePurchase.findFirst({
      where: { id: input.purchaseId, organizationId: input.organizationId },
      select: { id: true, organizationId: true, status: true, credits: true, creditEntry: { select: { balanceAfter: true } } },
    });
    if (!purchase) throw new DomainError("PURCHASE_NOT_FOUND", 404, "Compra não encontrada nesta organização.");
    if (purchase.creditEntry) return { purchaseId: purchase.id, creditedNow: false, balance: purchase.creditEntry.balanceAfter };
    if (purchase.status !== OneTimePurchaseStatus.PENDING) {
      throw new DomainError("PURCHASE_NOT_COMPLETABLE", 409, "Esta compra não pode conceder créditos.");
    }

    const balance = await increaseBalance(transaction, purchase.organizationId, purchase.credits);
    await transaction.creditLedgerEntry.create({
      data: {
        organizationId: purchase.organizationId,
        purchaseId: purchase.id,
        type: CreditLedgerEntryType.ONE_TIME_PURCHASE,
        delta: purchase.credits,
        balanceAfter: balance.balance,
        idempotencyKey: `one-time-purchase:${purchase.id}`,
        description: "Créditos concedidos por compra avulsa.",
      },
    });
    await transaction.oneTimePurchase.update({
      where: { id: purchase.id },
      data: { status: OneTimePurchaseStatus.COMPLETED, completedAt: new Date() },
    });
    return { purchaseId: purchase.id, creditedNow: true, balance: balance.balance };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Consome exatamente um crédito ao publicar o casamento, em transação serializável. */
export async function activateWeddingWithCredit(input: { organizationId: string; weddingId: string }) {
  return withTransactionRetry(() => prisma.$transaction(async (transaction) => {
    const wedding = await transaction.wedding.findFirst({
      where: { id: input.weddingId, organizationId: input.organizationId },
      select: { id: true, status: true, publicAccessStartsAt: true, publicAccessEndsAt: true, publicAccessRevokedAt: true },
    });
    if (!wedding) throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");
    if (wedding.status === WeddingStatus.ACTIVE) {
      const balance = await transaction.organizationCreditBalance.findUnique({
        where: { organizationId: input.organizationId },
        select: { balance: true },
      });
      return { weddingId: wedding.id, activatedNow: false, balance: balance?.balance ?? 0 };
    }
    if (wedding.status !== WeddingStatus.DRAFT) {
      throw new DomainError("WEDDING_NOT_ACTIVATABLE", 409, "Somente casamentos em rascunho podem ser ativados.");
    }
    if (!wedding.publicAccessStartsAt || !wedding.publicAccessEndsAt || wedding.publicAccessRevokedAt) {
      throw new DomainError("PUBLIC_ACCESS_WINDOW_REQUIRED", 409, "Defina a janela de acesso público antes de ativar o casamento.");
    }

    const existingConsumption = await transaction.creditLedgerEntry.findFirst({
      where: {
        organizationId: input.organizationId,
        weddingId: wedding.id,
        type: CreditLedgerEntryType.WEDDING_ACTIVATION,
      },
      select: { balanceAfter: true },
    });
    if (existingConsumption) {
      await transaction.wedding.update({ where: { id: wedding.id }, data: { status: WeddingStatus.ACTIVE } });
      return { weddingId: wedding.id, activatedNow: false, balance: existingConsumption.balanceAfter };
    }

    await transaction.organizationCreditBalance.upsert({
      where: { organizationId: input.organizationId },
      create: { organizationId: input.organizationId, balance: 0 },
      update: {},
    });
    const debit = await transaction.organizationCreditBalance.updateMany({
      where: { organizationId: input.organizationId, balance: { gte: 1 } },
      data: { balance: { decrement: 1 } },
    });
    if (debit.count !== 1) {
      throw new DomainError("INSUFFICIENT_CREDITS", 409, "Sua organização não possui créditos para ativar este casamento.");
    }
    const balance = await transaction.organizationCreditBalance.findUniqueOrThrow({
      where: { organizationId: input.organizationId },
      select: { balance: true },
    });
    await transaction.creditLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        weddingId: wedding.id,
        type: CreditLedgerEntryType.WEDDING_ACTIVATION,
        delta: -1,
        balanceAfter: balance.balance,
        idempotencyKey: `wedding-activation:${wedding.id}`,
        description: "Crédito consumido na ativação do casamento.",
      },
    });
    await transaction.wedding.update({ where: { id: wedding.id }, data: { status: WeddingStatus.ACTIVE } });
    return { weddingId: wedding.id, activatedNow: true, balance: balance.balance };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

export async function getOrganizationCreditBalance(organizationId: string) {
  const [balance, entries] = await Promise.all([
    prisma.organizationCreditBalance.findUnique({ where: { organizationId }, select: { balance: true, updatedAt: true } }),
    prisma.creditLedgerEntry.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, type: true, delta: true, balanceAfter: true, description: true, weddingId: true, createdAt: true },
    }),
  ]);
  return { balance: balance?.balance ?? 0, updatedAt: balance?.updatedAt ?? null, entries };
}
