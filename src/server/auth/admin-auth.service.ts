import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { AccountStatus, CustomerType, ManualAccessPlanStatus, OrganizationRole, PlatformRole } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import { reconcileManualAccessPlansForOrganizations } from "@/server/billing/manual-access-plan.service";

const scrypt = promisify(scryptCallback);
export const ADMIN_SESSION_COOKIE = "sitecasamento_admin_session";
export const PLATFORM_SESSION_COOKIE = "sitecasamento_platform_session";
export const DEMO_ADMIN_EMAIL = "cerimonial@demo.test";
export const DEMO_ADMIN_PASSWORD = "cerimonial1234";
export const DEMO_CREDIT_BALANCE = 2_147_483_647;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;

function normalizeEmail(email: unknown) {
  if (typeof email !== "string") throw new DomainError("INVALID_CREDENTIALS", 401, "E-mail ou senha inválidos.");
  const value = email.trim().toLocaleLowerCase("en-US");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) || value.length > 254) {
    throw new DomainError("INVALID_CREDENTIALS", 401, "E-mail ou senha inválidos.");
  }
  return value;
}

function validatePassword(password: unknown) {
  if (typeof password !== "string" || password.length < 6 || password.length > 256) {
    throw new DomainError("INVALID_PASSWORD", 400, "A senha deve ter entre 6 e 256 caracteres.");
  }
  return password;
}

function normalizeCustomerType(customerType: unknown) {
  if (customerType === undefined || customerType === null || customerType === "") {
    return CustomerType.CEREMONIALIST;
  }
  if (customerType === CustomerType.CEREMONIALIST || customerType === CustomerType.COUPLE) {
    return customerType;
  }
  throw new DomainError("INVALID_CUSTOMER_TYPE", 400, "Selecione se a conta é de casal ou cerimonialista.");
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.adminSession.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  return { token, expiresAt };
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
}

/** Confirma uma ação sensível com a senha da própria conta autenticada. */
export async function confirmAdminPassword(input: { userId: string; password: unknown }) {
  if (typeof input.password !== "string" || input.password.length === 0) {
    throw new DomainError("INVALID_CURRENT_PASSWORD", 401, "Informe sua senha para confirmar esta ação.");
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { passwordHash: true, accountStatus: true },
  });

  if (
    !user?.passwordHash
    || user.accountStatus !== AccountStatus.ACTIVE
    || !(await verifyPassword(input.password, user.passwordHash))
  ) {
    throw new DomainError("INVALID_CURRENT_PASSWORD", 401, "Senha incorreta.");
  }
}

function isDemoAdminEmail(email: unknown) {
  return process.env.NODE_ENV !== "production"
    && typeof email === "string"
    && email.trim().toLowerCase() === DEMO_ADMIN_EMAIL;
}

/** Mantem a conta demo disponivel localmente sem depender do seed. */
async function ensureDemoAdminAccount() {
  if (process.env.NODE_ENV === "production") return;

  const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);
  const user = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    create: {
      email: DEMO_ADMIN_EMAIL,
      name: "Cerimonialista Demo",
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
    update: {
      name: "Cerimonialista Demo",
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
    select: { id: true },
  });

  let membership = await prisma.organizationMembership.findFirst({
    where: { userId: user.id },
    select: { organizationId: true },
  });

  if (!membership) {
    const organization = await prisma.organization.create({
      data: {
        name: "Cerimonial Demonstração",
        creditBalance: { create: { balance: DEMO_CREDIT_BALANCE } },
      },
      select: { id: true },
    });
    membership = await prisma.organizationMembership.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        role: OrganizationRole.OWNER,
      },
      select: { organizationId: true },
    });
  } else {
    await prisma.organizationCreditBalance.upsert({
      where: { organizationId: membership.organizationId },
      create: { organizationId: membership.organizationId, balance: DEMO_CREDIT_BALANCE },
      update: { balance: DEMO_CREDIT_BALANCE },
    });
  }
}

/** Provisioning boundary: call only from a protected platform/admin workflow. */
export async function setAdminPassword(input: { userId: string; password: unknown }) {
  const password = validatePassword(input.password);
  const passwordHash = await hashPassword(password);
  return prisma.user.update({
    where: { id: input.userId },
    data: { passwordHash, passwordUpdatedAt: new Date() },
    select: { id: true, email: true, passwordUpdatedAt: true },
  });
}

/** Provisiona o único acesso do dono da plataforma por um comando local seguro. */
export async function provisionPlatformAdministrator(input: {
  email: unknown;
  password: unknown;
  name?: unknown;
}) {
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const name = typeof input.name === "string" && input.name.trim().length > 0
    ? input.name.trim().slice(0, 80)
    : "Administrador da Plataforma";
  const passwordHash = await hashPassword(password);

  return prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      passwordHash,
      passwordUpdatedAt: new Date(),
      platformRole: PlatformRole.PLATFORM_ADMIN,
    },
    update: {
      name,
      passwordHash,
      passwordUpdatedAt: new Date(),
      platformRole: PlatformRole.PLATFORM_ADMIN,
    },
    select: { id: true, email: true, name: true, platformRole: true },
  });
}

export async function registerAdminUser(input: {
  name: unknown;
  email: unknown;
  password: unknown;
  customerType?: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw new DomainError("INVALID_NAME", 400, "Informe um nome de 2 a 80 caracteres.");
  }
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const customerType = normalizeCustomerType(input.customerType);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new DomainError("USER_EMAIL_EXISTS", 409, "Este e-mail já está cadastrado. Faça login.");
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      passwordUpdatedAt: new Date(),
      customerType,
    },
    select: { id: true, email: true, name: true, platformRole: true },
  });

  const organizationName = customerType === CustomerType.COUPLE ? `Casamento de ${name}` : `Cerimonial de ${name}`;
  const organization = await prisma.organization.create({
    data: {
      name: organizationName,
      creditBalance: { create: { balance: 0 } },
    },
  });

  await prisma.organizationMembership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      role: OrganizationRole.OWNER,
    },
  });

  const { token, expiresAt } = await createSession(user.id);

  return { token, expiresAt, user };
}

export async function checkUserIsPayingOrActive(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, accountStatus: true },
  });

  if (!user || user.accountStatus !== AccountStatus.ACTIVE) return false;

  // O e-mail cerimonial@demo.test é sempre pagante/ativo para testes
  if (process.env.NODE_ENV !== "production" && user?.email === DEMO_ADMIN_EMAIL) {
    return true;
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  if (!memberships.length) return false;
  const orgIds = memberships.map((m) => m.organizationId);
  await reconcileManualAccessPlansForOrganizations(orgIds);

  const [balances, subscriptions, weddings, manualPlans] = await Promise.all([
    prisma.organizationCreditBalance.findMany({
      where: { organizationId: { in: orgIds }, balance: { gt: 0 } },
    }),
    prisma.organizationSubscription.findMany({
      where: { organizationId: { in: orgIds }, status: { in: ["ACTIVE", "PAST_DUE"] } },
    }),
    prisma.wedding.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true },
      take: 1,
    }),
    prisma.manualAccessPlan.count({
      where: {
        organizationId: { in: orgIds },
        status: ManualAccessPlanStatus.ACTIVE,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
    }),
  ]);

  return balances.length > 0 || subscriptions.length > 0 || weddings.length > 0 || manualPlans > 0;
}

/** Resumo seguro do acesso contratado para a própria conta, exibido em Configurações. */
export async function getAdminSubscriptionSummary(userId: string) {
  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    select: { organizationId: true },
  });
  const organizationIds = memberships.map((membership) => membership.organizationId);
  if (!organizationIds.length) return { creditsAvailable: 0, plan: null };

  await reconcileManualAccessPlansForOrganizations(organizationIds);
  const now = new Date();
  const [balances, plan] = await Promise.all([
    prisma.organizationCreditBalance.findMany({
      where: { organizationId: { in: organizationIds } },
      select: { balance: true },
    }),
    prisma.manualAccessPlan.findFirst({
      where: {
        customerId: userId,
        organizationId: { in: organizationIds },
        status: ManualAccessPlanStatus.ACTIVE,
        startDate: { lte: now },
        endDate: { gte: now },
      },
      orderBy: { startDate: "desc" },
      select: {
        durationMonths: true,
        creditsPerMonth: true,
        startDate: true,
        endDate: true,
        lastCreditReleasedAt: true,
        nextCreditReleaseAt: true,
        organization: { select: { name: true } },
      },
    }),
  ]);

  return {
    creditsAvailable: balances.reduce((total, balance) => total + balance.balance, 0),
    plan: plan ? {
      organizationName: plan.organization.name,
      durationMonths: plan.durationMonths,
      creditsPerMonth: plan.creditsPerMonth,
      startDate: plan.startDate.toISOString(),
      endDate: plan.endDate.toISOString(),
      lastCreditReleasedAt: plan.lastCreditReleasedAt?.toISOString() ?? null,
      nextCreditReleaseAt: plan.nextCreditReleaseAt?.toISOString() ?? null,
    } : null,
  };
}

export async function updateAdminProfile(input: {
  userId: string;
  name?: unknown;
  email?: unknown;
  currentPassword?: unknown;
  newPassword?: unknown;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  if (!user) throw new DomainError("USER_NOT_FOUND", 404, "Usuário não encontrado.");

  const updateData: { name?: string; email?: string; passwordHash?: string; passwordUpdatedAt?: Date } = {};

  if (typeof input.name === "string" && input.name.trim().length >= 2) {
    updateData.name = input.name.trim();
  }

  if (input.email && typeof input.email === "string") {
    const newEmail = normalizeEmail(input.email);
    if (newEmail !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing) throw new DomainError("EMAIL_IN_USE", 409, "Este e-mail já está em uso.");
      updateData.email = newEmail;
    }
  }

  if (input.newPassword) {
    if (!user.passwordHash || typeof input.currentPassword !== "string" || !(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new DomainError("INVALID_CURRENT_PASSWORD", 400, "Senha atual incorreta.");
    }
    const newPass = validatePassword(input.newPassword);
    updateData.passwordHash = await hashPassword(newPass);
    updateData.passwordUpdatedAt = new Date();
  }

  const updatedUser = await prisma.user.update({
    where: { id: input.userId },
    data: updateData,
    select: { id: true, email: true, name: true },
  });

  return updatedUser;
}

async function authenticateUser(input: { email: unknown; password: unknown }, platformOnly: boolean) {
  const email = normalizeEmail(input.email);
  if (typeof input.password !== "string") throw new DomainError("INVALID_CREDENTIALS", 401, "E-mail ou senha inválidos.");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true, platformRole: true, accountStatus: true },
  });
  if (
    !user?.passwordHash
    || !(await verifyPassword(input.password, user.passwordHash))
    || user.accountStatus !== AccountStatus.ACTIVE
    || (platformOnly && user.platformRole !== PlatformRole.PLATFORM_ADMIN)
  ) {
    throw new DomainError("INVALID_CREDENTIALS", 401, "E-mail ou senha inválidos.");
  }

  const { token, expiresAt } = await createSession(user.id);
  return { token, expiresAt, user: { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole } };
}

export async function authenticateAdmin(input: { email: unknown; password: unknown }) {
  if (isDemoAdminEmail(input.email)) await ensureDemoAdminAccount();
  return authenticateUser(input, false);
}

/** Login exclusivo do proprietário; contas de organizações são rejeitadas. */
export async function authenticatePlatformAdministrator(input: { email: unknown; password: unknown }) {
  return authenticateUser(input, true);
}

export async function getAdminSessionFromToken(token: string | undefined) {
  if (!token || token.length < 32 || token.length > 200) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, platformRole: true, accountStatus: true } },
    },
  });
  if (!session || session.user.accountStatus !== AccountStatus.ACTIVE) return null;
  if (session.expiresAt <= new Date()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  await prisma.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  return session.user;
}

export async function getCurrentAdminSession() {
  const cookieStore = await cookies();
  return getAdminSessionFromToken(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
}

export async function requireAdminSession() {
  const user = await getCurrentAdminSession();
  if (!user) throw new DomainError("ADMIN_AUTH_REQUIRED", 401, "Faça login para acessar o painel.");
  return user;
}

export async function getPlatformSessionFromToken(token: string | undefined) {
  const user = await getAdminSessionFromToken(token);
  return user?.platformRole === PlatformRole.PLATFORM_ADMIN ? user : null;
}

export async function getCurrentPlatformSession() {
  const cookieStore = await cookies();
  return getPlatformSessionFromToken(cookieStore.get(PLATFORM_SESSION_COOKIE)?.value);
}

export async function requirePlatformAdministrator() {
  const user = await getCurrentPlatformSession();
  if (!user) throw new DomainError("PLATFORM_ADMIN_REQUIRED", 403, "Acesso restrito ao administrador da plataforma.");
  return user;
}

export async function assertPlatformAdministratorUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, platformRole: true },
  });
  if (!user || user.platformRole !== PlatformRole.PLATFORM_ADMIN) {
    throw new DomainError("PLATFORM_ADMIN_REQUIRED", 403, "Acesso restrito ao administrador da plataforma.");
  }
  return user;
}

export async function revokeAdminSession(token: string | undefined) {
  if (!token) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
}

export function isPlatformAdministrator(role: PlatformRole) {
  return role === PlatformRole.PLATFORM_ADMIN;
}
