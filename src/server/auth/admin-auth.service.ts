import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { OrganizationRole, PlatformRole } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

const scrypt = promisify(scryptCallback);
export const ADMIN_SESSION_COOKIE = "sitecasamento_admin_session";
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
  if (typeof password !== "string" || password.length < 12 || password.length > 256) {
    throw new DomainError("INVALID_PASSWORD", 400, "A senha deve ter entre 12 e 256 caracteres.");
  }
  return password;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, expected] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === derived.length && timingSafeEqual(expectedBuffer, derived);
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

export async function registerAdminUser(input: {
  name: unknown;
  email: unknown;
  password: unknown;
}) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2 || name.length > 80) {
    throw new DomainError("INVALID_NAME", 400, "Informe um nome de 2 a 80 caracteres.");
  }
  const email = normalizeEmail(input.email);
  const password = validatePassword(input.password);

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
    },
    select: { id: true, email: true, name: true, platformRole: true },
  });

  // Criar organização da cerimonialista
  const organization = await prisma.organization.create({
    data: {
      name: `Cerimonial de ${name}`,
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

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.adminSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt } });

  return { token, expiresAt, user };
}

export async function checkUserIsPayingOrActive(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  // O e-mail cerimonial@demo.test é sempre pagante/ativo para testes
  if (user?.email === "cerimonial@demo.test") {
    return true;
  }

  const memberships = await prisma.organizationMembership.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  if (!memberships.length) return false;
  const orgIds = memberships.map((m) => m.organizationId);

  const [balances, subscriptions, weddings] = await Promise.all([
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
  ]);

  return balances.length > 0 || subscriptions.length > 0 || weddings.length > 0;
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

export async function authenticateAdmin(input: { email: unknown; password: unknown }) {
  const email = normalizeEmail(input.email);
  if (typeof input.password !== "string") throw new DomainError("INVALID_CREDENTIALS", 401, "E-mail ou senha inválidos.");
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true, platformRole: true },
  });
  if (!user?.passwordHash || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new DomainError("INVALID_CREDENTIALS", 401, "E-mail ou senha inválidos.");
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  await prisma.adminSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt } });
  return { token, expiresAt, user: { id: user.id, email: user.email, name: user.name, platformRole: user.platformRole } };
}

export async function getAdminSessionFromToken(token: string | undefined) {
  if (!token || token.length < 32 || token.length > 200) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: tokenHash(token) },
    select: {
      id: true,
      expiresAt: true,
      user: { select: { id: true, email: true, name: true, platformRole: true } },
    },
  });
  if (!session) return null;
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

export async function revokeAdminSession(token: string | undefined) {
  if (!token) return;
  await prisma.adminSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
}

export function isPlatformAdministrator(role: PlatformRole) {
  return role === PlatformRole.PLATFORM_ADMIN;
}
