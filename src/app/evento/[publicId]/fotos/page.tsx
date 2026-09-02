import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { EventView } from "@/features/event/types";
import { isDomainError } from "@/server/domain/error";
import { getActiveEventView } from "@/server/events/event-view.service";
import { MyPhotosClient } from "./my-photos-client";

export const metadata: Metadata = {
  title: "Minhas fotos | Jogo de Fotos",
  description: "Fotos guardadas localmente para o casamento.",
};

export default async function MyPhotosPage({ params }: { params: Promise<{ publicId: string }> }) {
  let event: EventView;

  try {
    const { publicId } = await params;
    event = await getActiveEventView(publicId);
  } catch (error) {
    if (isDomainError(error)) notFound();
    throw error;
  }

  return <MyPhotosClient event={event} />;
}
