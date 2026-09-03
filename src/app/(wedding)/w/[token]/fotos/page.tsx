import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MyPhotosClient } from "@/app/evento/[publicId]/fotos/my-photos-client";
import type { EventView } from "@/features/event/types";
import { isDomainError } from "@/server/domain/error";
import { getActiveEventView, getDevelopmentWeddingSlugRedirectPath } from "@/server/events/event-view.service";

export const metadata: Metadata = {
  title: "Minhas fotos | Jogo de Fotos",
  description: "Fotos guardadas localmente para o casamento.",
};

export default async function WeddingPhotosPage({ params }: { params: Promise<{ token: string }> }) {
  let event: EventView;
  const { token } = await params;
  try {
    event = await getActiveEventView(token);
  } catch (error) {
    if (isDomainError(error)) {
      const redirectPath = await getDevelopmentWeddingSlugRedirectPath(token, "/fotos");
      if (redirectPath) redirect(redirectPath);
      notFound();
    }
    throw error;
  }
  return <MyPhotosClient event={event} />;
}
