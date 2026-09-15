import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/LegalDocumentPage";
import { legalDocuments } from "@/lib/legal/legal-documents";

export const metadata: Metadata = {
  title: "Política de Privacidade | SiteCasamento",
  description: legalDocuments.privacyPolicy.summary,
};

export default function PrivacyPolicyPage() {
  return <LegalDocumentPage document={legalDocuments.privacyPolicy} />;
}
