export const LEGAL_DOCUMENT_VERSION = "1.0.0-draft";
export const LEGAL_EFFECTIVE_DATE = "2026-09-14";

export const currentLegalVersions = {
  termsOfUse: LEGAL_DOCUMENT_VERSION,
  privacyPolicy: LEGAL_DOCUMENT_VERSION,
  commercialTerms: LEGAL_DOCUMENT_VERSION,
} as const;
