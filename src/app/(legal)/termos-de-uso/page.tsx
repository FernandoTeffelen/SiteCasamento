import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/LegalDocumentPage";
import { legalDocuments } from "@/lib/legal/legal-documents";

export const metadata: Metadata = {
  title: "Termos de Uso | SiteCasamento",
  description: legalDocuments.termsOfUse.summary,
};

export default function TermsOfUsePage() {
  return <LegalDocumentPage document={legalDocuments.termsOfUse} />;
}
