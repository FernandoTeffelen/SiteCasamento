import { Prisma, WeddingTemplateTier } from "@/generated/prisma/client";
import { revalidateTag, unstable_cache } from "next/cache";
import {
  defaultWeddingVisualConfig,
  normalizeWeddingVisualOverrides,
  resolveWeddingVisualConfig,
  type WeddingVisualOverrides,
} from "@/lib/templates/wedding-visual-config";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

const WEDDING_TEMPLATES_TAG = "wedding-templates-v1";

function canUseNextDataCache() {
  return Boolean(process.env.NEXT_RUNTIME);
}

export function invalidateWeddingTemplatesCache() {
  if (canUseNextDataCache()) revalidateTag(WEDDING_TEMPLATES_TAG, "max");
}

async function readWeddingTemplates(tier?: WeddingTemplateTier) {
  return prisma.weddingTemplate.findMany({
    where: { active: true, ...(tier ? { tier } : {}) },
    orderBy: [{ tier: "asc" }, { name: "asc" }],
    select: { id: true, slug: true, name: true, description: true, tier: true, thumbnailUrl: true, previewUrl: true },
  });
}

function getCachedWeddingTemplates(tier?: WeddingTemplateTier) {
  return unstable_cache(
    () => readWeddingTemplates(tier),
    ["wedding-templates-v1", tier ?? "all"],
    { tags: [WEDDING_TEMPLATES_TAG], revalidate: 3_600 },
  );
}

/** Templates ativos são públicos e pouco mutáveis; alterações usam a tag global. */
export async function listWeddingTemplates(tier?: WeddingTemplateTier) {
  if (!canUseNextDataCache()) return readWeddingTemplates(tier);
  return getCachedWeddingTemplates(tier)();
}

function weddingVisualConfigTag(weddingId: string) {
  return `wedding-visual-config:${weddingId}`;
}

export function invalidateWeddingVisualConfigCache(weddingId: string) {
  if (canUseNextDataCache()) revalidateTag(weddingVisualConfigTag(weddingId), "max");
}

async function readWeddingVisualConfig(input: { organizationId: string; weddingId: string }) {
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

function getCachedWeddingVisualConfig(input: { organizationId: string; weddingId: string }) {
  return unstable_cache(
    () => readWeddingVisualConfig(input),
    ["wedding-visual-config-v1", input.organizationId, input.weddingId],
    { tags: [weddingVisualConfigTag(input.weddingId)], revalidate: 3_600 },
  );
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
  invalidateWeddingVisualConfigCache(input.weddingId);
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
  invalidateWeddingVisualConfigCache(wedding.id);
  return getWeddingVisualConfig({ organizationId: wedding.organizationId, weddingId: wedding.id });
}

export async function getWeddingVisualConfig(input: { organizationId: string; weddingId: string }) {
  if (!canUseNextDataCache()) return readWeddingVisualConfig(input);
  return getCachedWeddingVisualConfig(input)();
}
