import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { EventView } from "@/features/event/types";
import { isDomainError } from "@/server/domain/error";
import { getActiveEventView } from "@/server/events/event-view.service";
import { WelcomeClient } from "./welcome-client";

export const metadata: Metadata = {
  title: "Jogo de Fotos",
  description: "Entre no jogo de fotos do casamento.",
};

export default async function EventWelcomePage({ params }: { params: Promise<{ publicId: string }> }) {
  let event: EventView;

  try {
    const { publicId } = await params;
    event = await getActiveEventView(publicId);
  } catch (error) {
    if (isDomainError(error)) notFound();
    throw error;
  }

  return <WelcomeClient event={event} />;
}
