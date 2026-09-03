import { redirect } from "next/navigation";

export default async function LegacyGamePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  redirect(`/w/${encodeURIComponent(publicId)}/jogo`);
}
