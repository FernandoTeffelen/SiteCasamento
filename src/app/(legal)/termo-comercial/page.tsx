import type { Metadata } from "next";
import { LegalDocumentPage } from "@/features/legal/LegalDocumentPage";
import { legalDocuments } from "@/lib/legal/legal-documents";

export const metadata: Metadata = {
  title: "Termo Comercial | SiteCasamento",
  description: legalDocuments.commercialTerms.summary,
};

export default function CommercialTermsPage() {
  return <LegalDocumentPage document={legalDocuments.commercialTerms} />;
}
