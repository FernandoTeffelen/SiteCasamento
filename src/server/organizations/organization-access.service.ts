import { OrganizationRole } from "@/generated/prisma/client";
import { DomainError } from "@/server/domain/error";
import { prisma } from "@/server/db/prisma";

/**
 * Boundary for future administrative routes. Authentication must resolve the
 * current user before calling these functions; guest tokens never authorize
 * organization access.
 */
export async function assertUserCanAccessOrganization(userId: string, organizationId: string) {
  const membership = await prisma.organizationMembership.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
    select: { organizationId: true, role: true },
  });

  if (!membership) {
    throw new DomainError("ORGANIZATION_ACCESS_DENIED", 403, "Você não tem acesso a esta organização.");
  }

  return membership;
}

export async function assertUserCanManageOrganization(userId: string, organizationId: string) {
  const membership = await assertUserCanAccessOrganization(userId, organizationId);
  if (membership.role === OrganizationRole.MEMBER) {
    throw new DomainError("ORGANIZATION_MANAGEMENT_DENIED", 403, "Você não pode administrar esta organização.");
  }
  return membership;
}

/** Resolves a wedding only after verifying membership in its organization. */
export async function findWeddingForOrganizationUser(input: {
  userId: string;
  organizationId: string;
  weddingId: string;
}) {
  await assertUserCanAccessOrganization(input.userId, input.organizationId);

  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: input.organizationId },
    select: { id: true, organizationId: true, name: true, status: true },
  });

  if (!wedding) {
    throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");
  }

  return wedding;
}
