import { redirect } from "next/navigation";

/** URL legada: somente tokens opacos continuam funcionando; slugs não são públicos. */
export default async function LegacyEventWelcomePage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  redirect(`/w/${encodeURIComponent(publicId)}`);
}
