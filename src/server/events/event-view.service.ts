import type { EventView } from "@/features/event/types";
import { assertWeddingIsActive, findWeddingByIdentifier } from "./wedding.service";

export async function getActiveEventView(identifier: string): Promise<EventView> {
  const wedding = await findWeddingByIdentifier(identifier);
  assertWeddingIsActive(wedding);

  return {
    identifier,
    publicId: wedding.publicId,
    slug: wedding.slug,
    name: wedding.name,
    brideName: wedding.brideName,
    groomName: wedding.groomName,
  };
}
