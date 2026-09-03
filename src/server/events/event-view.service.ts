import type { EventView } from "@/features/event/types";
import { isDomainError } from "@/server/domain/error";
import { assertWeddingIsActive, findWeddingByIdentifier, findWeddingByPublicAccessToken } from "./wedding.service";
import { getWeddingVisualConfig } from "@/server/templates/wedding-template.service";

export async function getActiveEventView(identifier: string): Promise<EventView> {
  const wedding = await findWeddingByPublicAccessToken(identifier);
  assertWeddingIsActive(wedding);
  const visual = await getWeddingVisualConfig({ organizationId: wedding.organizationId, weddingId: wedding.id });

  return {
    identifier,
    publicPath: `/w/${encodeURIComponent(wedding.publicId)}`,
    publicId: wedding.publicId,
    slug: wedding.slug,
    name: wedding.name,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
    visual,
  };
}

export async function getDevelopmentWeddingSlugRedirectPath(identifier: string, suffix = ""): Promise<string | null> {
  if (process.env.NODE_ENV === "production") return null;

  try {
    const wedding = await findWeddingByIdentifier(identifier);
    if (wedding.slug !== identifier || wedding.publicId === identifier) return null;

    assertWeddingIsActive(wedding);
    return `/w/${encodeURIComponent(wedding.publicId)}${suffix}`;
  } catch (error) {
    if (isDomainError(error)) return null;
    throw error;
  }
}
