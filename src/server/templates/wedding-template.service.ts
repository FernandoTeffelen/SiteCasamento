import { Prisma, WeddingTemplateTier } from "@/generated/prisma/client";
import {
  defaultWeddingVisualConfig,
  normalizeWeddingVisualOverrides,
  resolveWeddingVisualConfig,
  type WeddingVisualOverrides,
} from "@/lib/templates/wedding-visual-config";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

export async function listWeddingTemplates(tier?: WeddingTemplateTier) {
  return prisma.weddingTemplate.findMany({
    where: { active: true, ...(tier ? { tier } : {}) },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, description: true, tier: true, thumbnailUrl: true, previewUrl: true },
  });
}

/** Use after administrative authorization; templates are global assets, weddings remain organization-scoped. */
export async function assignWeddingTemplate(input: { organizationId: string; weddingId: string; templateId: string }) {
  const template = await prisma.weddingTemplate.findFirst({
    where: { id: input.templateId, active: true },
    select: { id: true },
  });
  if (!template) throw new DomainError("TEMPLATE_NOT_FOUND", 404, "Template não encontrado ou indisponível.");

  const updated = await prisma.wedding.updateMany({
    where: { id: input.weddingId, organizationId: input.organizationId },
    data: { templateId: template.id },
  });
  if (updated.count === 0) throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");
}

export async function updateWeddingCustomization(input: {
  organizationId: string;
  weddingId: string;
  overrides: unknown;
}) {
  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: input.organizationId },
    include: { template: { select: { defaultConfig: true } }, customization: true },
  });
  if (!wedding) throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");

  const overrides = normalizeWeddingVisualOverrides(input.overrides) as WeddingVisualOverrides;
  await prisma.weddingCustomization.upsert({
    where: { weddingId: wedding.id },
    create: { organizationId: wedding.organizationId, weddingId: wedding.id, overrides: overrides as Prisma.InputJsonValue },
    update: { overrides: overrides as Prisma.InputJsonValue },
  });
  return getWeddingVisualConfig({ organizationId: wedding.organizationId, weddingId: wedding.id });
}

export async function getWeddingVisualConfig(input: { organizationId: string; weddingId: string }) {
  const wedding = await prisma.wedding.findFirst({
    where: { id: input.weddingId, organizationId: input.organizationId },
    select: { template: { select: { defaultConfig: true } }, customization: { select: { overrides: true } } },
  });
  if (!wedding) throw new DomainError("WEDDING_NOT_FOUND", 404, "Casamento não encontrado nesta organização.");
  return resolveWeddingVisualConfig(
    wedding.template?.defaultConfig ?? defaultWeddingVisualConfig,
    wedding.customization?.overrides,
  );
}
