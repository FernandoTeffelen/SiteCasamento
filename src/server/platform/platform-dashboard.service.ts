import { AccountStatus, AdminAuditAction, CreditLedgerEntryType, PlatformRole, SubscriptionStatus, WeddingStatus } from "@/generated/prisma/client";
import { randomUUID } from "node:crypto";
import { assertPlatformAdministratorUser } from "@/server/auth/admin-auth.service";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import {
  createManualAccessPlan,
  reconcileManualAccessPlansForOrganizations,
  updateManualAccessPlanStatus,
} from "@/server/billing/manual-access-plan.service";

/** Dados agregados da operação, nunca expostos a usuários de organizações. */
export async function getPlatformDashboardData(userId: string) {
  await assertPlatformAdministratorUser(userId);

  const [organizations, users, weddings, photos, activeSubscriptions, weddingsByStatus] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count({ where: { platformRole: PlatformRole.USER } }),
    prisma.wedding.count(),
    prisma.photo.count(),
    prisma.organizationSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.wedding.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const weddingStatusCounts = Object.fromEntries(
    Object.values(WeddingStatus).map((status) => [status, 0]),
  ) as Record<WeddingStatus, number>;
  for (const item of weddingsByStatus) weddingStatusCounts[item.status] = item._count._all;

  return {
    metrics: { organizations, users, weddings, photos, activeSubscriptions },
    weddingStatusCounts,
  };
}

function normalizeSearch(search: unknown) {
  if (typeof search !== "string") return "";
  return search.trim().slice(0, 120);
}

function normalizePage(page: unknown) {
  const parsed = typeof page === "number" ? page : Number(page);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 10_000) : 1;
}

const customerSelect = {
  id: true,
  name: true,
  email: true,
  customerType: true,
  accountStatus: true,
  createdAt: true,
  memberships: {
    select: {
      organization: { select: { creditBalance: { select: { balance: true } } } },
    },
  },
} as const;

function formatCustomer(customer: {
  id: string;
  name: string | null;
  email: string;
  customerType: "CEREMONIALIST" | "COUPLE";
  accountStatus: "ACTIVE" | "SUSPENDED";
  createdAt: Date;
  memberships: Array<{ organization: { creditBalance: { balance: number } | null } }>;
}) {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    customerType: customer.customerType,
    accountStatus: customer.accountStatus,
    createdAt: customer.createdAt,
    creditsAvailable: customer.memberships.reduce(
      (total, membership) => total + (membership.organization.creditBalance?.balance ?? 0),
      0,
    ),
  };
}

export async function getPlatformCustomers(input: {
  userId: string;
  search?: unknown;
  page?: unknown;
  pageSize?: number;
}) {
  await assertPlatformAdministratorUser(input.userId);
  const search = normalizeSearch(input.search);
  const page = normalizePage(input.page);
  const pageSize = Math.min(Math.max(input.pageSize ?? 25, 1), 50);
  const where = {
    platformRole: PlatformRole.USER,
    ...(search
      ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: customerSelect,
    }),
  ]);

  return {
    customers: customers.map((customer) => formatCustomer(customer)),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    search,
  };
}

export async function getPlatformCustomerDetails(input: { userId: string; customerId: string }) {
  await assertPlatformAdministratorUser(input.userId);
  const membershipIds = await prisma.organizationMembership.findMany({
    where: { userId: input.customerId },
    select: { organizationId: true },
  });
  await reconcileManualAccessPlansForOrganizations(membershipIds.map((membership) => membership.organizationId));
  const customer = await prisma.user.findFirst({
    where: { id: input.customerId, platformRole: PlatformRole.USER },
    select: {
      ...customerSelect,
      passwordUpdatedAt: true,
      memberships: {
        select: {
          role: true,
          organization: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              creditBalance: { select: { balance: true, updatedAt: true } },
              _count: { select: { weddings: true } },
              subscriptions: {
                where: { status: SubscriptionStatus.ACTIVE },
                select: { tier: true, period: true, currentPeriodEnd: true },
                take: 1,
              },
              manualAccessPlans: {
                orderBy: { createdAt: "desc" },
                select: {
                  id: true,
                  status: true,
                  durationMonths: true,
                  creditsPerMonth: true,
                  startDate: true,
                  endDate: true,
                  lastCreditReleasedAt: true,
                  nextCreditReleaseAt: true,
                  canceledAt: true,
                  createdAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!customer) throw new DomainError("CUSTOMER_NOT_FOUND", 404, "Cliente não encontrado.");

  const organizationIds = customer.memberships.map((membership) => membership.organization.id);
  const creditLedgerWhere = { organizationId: { in: organizationIds } };
  const [received, used, creditMovements] = await Promise.all([
    prisma.creditLedgerEntry.aggregate({
      where: { ...creditLedgerWhere, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    prisma.creditLedgerEntry.aggregate({
      where: { ...creditLedgerWhere, delta: { lt: 0 } },
      _sum: { delta: true },
    }),
    prisma.creditLedgerEntry.findMany({
      where: creditLedgerWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        type: true,
        delta: true,
        balanceAfter: true,
        description: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    }),
  ]);
  const manualPlans = customer.memberships.flatMap((membership) => membership.organization.manualAccessPlans);
  const lastCreditReleasedAt = manualPlans.reduce<Date | null>((latest, plan) => (
    plan.lastCreditReleasedAt && (!latest || plan.lastCreditReleasedAt > latest)
      ? plan.lastCreditReleasedAt
      : latest
  ), null);
  const nextCreditReleaseAt = manualPlans.reduce<Date | null>((next, plan) => (
    plan.status === "ACTIVE"
      && plan.nextCreditReleaseAt
      && (!next || plan.nextCreditReleaseAt < next)
      ? plan.nextCreditReleaseAt
      : next
  ), null);

  return {
    customer: formatCustomer(customer),
    passwordUpdatedAt: customer.passwordUpdatedAt,
    organizations: customer.memberships.map((membership) => ({
      role: membership.role,
      ...membership.organization,
    })),
    creditSummary: {
      received: received._sum.delta ?? 0,
      used: Math.abs(used._sum.delta ?? 0),
      available: customer.memberships.reduce(
        (total, membership) => total + (membership.organization.creditBalance?.balance ?? 0),
        0,
      ),
      lastCreditReleasedAt,
      nextCreditReleaseAt,
    },
    creditMovements,
  };
}

export async function updatePlatformCustomerStatus(input: {
  userId: string;
  customerId: string;
  accountStatus: unknown;
}) {
  await assertPlatformAdministratorUser(input.userId);
  const accountStatus = input.accountStatus;
  if (accountStatus !== AccountStatus.ACTIVE && accountStatus !== AccountStatus.SUSPENDED) {
    throw new DomainError("INVALID_ACCOUNT_STATUS", 400, "Status de conta inválido.");
  }

  const customer = await prisma.user.findFirst({
    where: { id: input.customerId, platformRole: PlatformRole.USER },
    select: { id: true },
  });
  if (!customer) throw new DomainError("CUSTOMER_NOT_FOUND", 404, "Cliente não encontrado.");

  return prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.update({
      where: { id: customer.id },
      data: { accountStatus },
      select: { id: true, accountStatus: true },
    });
    if (accountStatus === AccountStatus.SUSPENDED) {
      await transaction.adminSession.deleteMany({ where: { userId: customer.id } });
    }
    await transaction.adminAuditLog.create({
      data: {
        action: AdminAuditAction.CUSTOMER_STATUS_CHANGED,
        actorUserId: input.userId,
        customerId: customer.id,
        metadata: { accountStatus },
      },
    });
    return updated;
  });
}

export async function deletePlatformCustomer(input: { userId: string; customerId: string }) {
  await assertPlatformAdministratorUser(input.userId);
  const customer = await prisma.user.findFirst({
    where: { id: input.customerId, platformRole: PlatformRole.USER },
    select: { id: true, email: true, name: true },
  });
  if (!customer) throw new DomainError("CUSTOMER_NOT_FOUND", 404, "Cliente não encontrado.");

  return prisma.$transaction(async (transaction) => {
    const memberships = await transaction.organizationMembership.findMany({
      where: { userId: customer.id },
      select: { organizationId: true },
    });
    const auditOrganizations = memberships.length ? memberships : [{ organizationId: null }];
    for (const membership of auditOrganizations) {
      await transaction.adminAuditLog.create({
        data: {
          action: AdminAuditAction.CUSTOMER_DELETED,
          actorUserId: input.userId,
          customerId: customer.id,
          organizationId: membership.organizationId,
          metadata: { email: customer.email, name: customer.name },
        },
      });
    }
    for (const membership of memberships) {
      const otherMembers = await transaction.organizationMembership.count({
        where: { organizationId: membership.organizationId, userId: { not: customer.id } },
      });
      if (otherMembers === 0) {
        await transaction.organization.delete({ where: { id: membership.organizationId } });
      }
    }
    await transaction.user.delete({ where: { id: customer.id } });
    return { id: customer.id, deleted: true };
  });
}

export async function addPlatformCustomerCredits(input: {
  userId: string;
  customerId: string;
  organizationId: string;
  credits: unknown;
}) {
  await assertPlatformAdministratorUser(input.userId);
  const credits = typeof input.credits === "number" ? input.credits : Number(input.credits);
  if (!Number.isInteger(credits) || credits < 1 || credits > 1_000) {
    throw new DomainError("INVALID_CREDIT_ADJUSTMENT", 400, "Informe entre 1 e 1.000 créditos.");
  }

  return prisma.$transaction(async (transaction) => {
    const membership = await transaction.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId: input.organizationId, userId: input.customerId } },
      select: { organizationId: true },
    });
    if (!membership) throw new DomainError("CUSTOMER_ORGANIZATION_NOT_FOUND", 404, "A organização não pertence a este cliente.");

    const balance = await transaction.organizationCreditBalance.upsert({
      where: { organizationId: input.organizationId },
      create: { organizationId: input.organizationId, balance: credits },
      update: { balance: { increment: credits } },
      select: { balance: true },
    });
    await transaction.creditLedgerEntry.create({
      data: {
        organizationId: input.organizationId,
        type: CreditLedgerEntryType.ADJUSTMENT,
        delta: credits,
        balanceAfter: balance.balance,
        idempotencyKey: `platform-manual-credit:${randomUUID()}`,
        description: `Crédito${credits === 1 ? "" : "s"} avulso${credits === 1 ? "" : "s"} liberado${credits === 1 ? "" : "s"} manualmente.`,
      },
    });
    await transaction.adminAuditLog.create({
      data: {
        action: AdminAuditAction.CREDIT_ADJUSTED,
        actorUserId: input.userId,
        customerId: input.customerId,
        organizationId: input.organizationId,
        metadata: { credits, balance: balance.balance, kind: "ONE_TIME_MANUAL_CREDIT" },
      },
    });
    return { credits, balance: balance.balance };
  });
}

export async function createPlatformManualAccessPlan(input: {
  userId: string;
  customerId: string;
  organizationId: string;
  durationMonths: unknown;
  creditsPerMonth: unknown;
  startDate: unknown;
  status: unknown;
  adjustmentMode?: unknown;
}) {
  await assertPlatformAdministratorUser(input.userId);
  return createManualAccessPlan({
    ...input,
    createdByUserId: input.userId,
  });
}

export async function updatePlatformManualAccessPlanStatus(input: {
  userId: string;
  customerId: string;
  planId: string;
  status: unknown;
}) {
  await assertPlatformAdministratorUser(input.userId);
  return updateManualAccessPlanStatus({ ...input, actorUserId: input.userId });
}
