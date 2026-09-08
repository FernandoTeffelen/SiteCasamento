import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GameClient } from "@/app/evento/[publicId]/jogo/game-client";
import type { EventView } from "@/features/event/types";
import { isDomainError } from "@/server/domain/error";
import { getActiveEventView, getDevelopmentWeddingSlugRedirectPath } from "@/server/events/event-view.service";

export const metadata: Metadata = {
  title: "Jogo de Fotos",
  description: "Missões do jogo de fotos do casamento.",
};

export const dynamic = "force-dynamic";

export default async function WeddingGamePage({ params }: { params: Promise<{ token: string }> }) {
  let event: EventView;
  const { token } = await params;
  try {
    event = await getActiveEventView(token);
  } catch (error) {
    if (isDomainError(error)) {
      const redirectPath = await getDevelopmentWeddingSlugRedirectPath(token, "/jogo");
      if (redirectPath) redirect(redirectPath);
      notFound();
    }
    throw error;
  }
  return <GameClient event={event} />;
}
