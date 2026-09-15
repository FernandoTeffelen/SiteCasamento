import { createHash } from "node:crypto";
import { LegalAcceptanceContext, LegalDocumentType, Prisma } from "@/generated/prisma/client";
import { getLegalDocument, legalDocumentList, type LegalDocumentTypeValue } from "@/lib/legal/legal-documents";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";

type Transaction = Prisma.TransactionClient;

export type LegalEvidence = {
  ipAddress?: string | null;
  userAgent?: string | null;
  clientAcceptedAt?: string | null;
};

type AcceptanceInput = LegalEvidence & {
  type: LegalDocumentTypeValue;
  version: unknown;
  accepted: unknown;
  context: LegalAcceptanceContext;
  userId?: string;
  guestId?: string;
  organizationId?: string;
  contextReference?: string;
  contextSnapshot?: Prisma.InputJsonValue;
};

export function getLegalDocumentContentHash(type: LegalDocumentTypeValue) {
  return createHash("sha256").update(JSON.stringify(getLegalDocument(type))).digest("hex");
}

function sanitizedHeader(value: string | null | undefined, maxLength: number) {
  const normalized = value?.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

function parsedClientAcceptedAt(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  const now = Date.now();
  if (date.valueOf() > now + 5 * 60_000 || date.valueOf() < now - 30 * 24 * 60 * 60_000) return null;
  return date;
}

function evidenceKey(input: AcceptanceInput) {
  const actor = input.userId ? `user:${input.userId}` : `guest:${input.guestId}`;
  const snapshotHash = input.contextSnapshot
    ? createHash("sha256").update(JSON.stringify(input.contextSnapshot)).digest("hex")
    : "no-snapshot";
  const raw = [input.context, input.type, getLegalDocument(input.type).version, actor, input.contextReference ?? "general", snapshotHash].join(":");
  return createHash("sha256").update(raw).digest("hex");
}

export async function syncLegalDocuments(database: Transaction | typeof prisma = prisma) {
  for (const document of legalDocumentList) {
    const where = { type_version: { type: document.type as LegalDocumentType, version: document.version } };
    const expectedHash = getLegalDocumentContentHash(document.type);
    const existing = await database.legalDocumentVersion.findUnique({ where, select: { id: true, contentHash: true } });
    if (existing && existing.contentHash !== expectedHash) {
      throw new Error(`O conteúdo de ${document.type}/${document.version} mudou. Publique uma nova versão antes de sincronizar.`);
    }
    if (existing) {
      await database.legalDocumentVersion.update({
        where: { id: existing.id },
        data: { title: document.title, publicPath: document.publicPath, active: true },
      });
    } else {
      await database.legalDocumentVersion.create({
        data: {
        type: document.type as LegalDocumentType,
        version: document.version,
        title: document.title,
        publicPath: document.publicPath,
        contentHash: expectedHash,
        effectiveAt: new Date(`${document.effectiveDate}T00:00:00.000Z`),
      },
      });
    }
  }
}

export async function recordLegalAcceptance(input: AcceptanceInput, database: Transaction | typeof prisma = prisma) {
  const document = getLegalDocument(input.type);
  if (input.accepted !== true || input.version !== document.version) {
    throw new DomainError("LEGAL_ACCEPTANCE_REQUIRED", 400, `Leia e aceite a versão atual de ${document.shortTitle}.`);
  }
  if (!input.userId && !input.guestId) {
    throw new DomainError("LEGAL_ACTOR_REQUIRED", 400, "Não foi possível identificar quem realizou o aceite.");
  }

  const documentVersion = await database.legalDocumentVersion.upsert({
    where: { type_version: { type: input.type as LegalDocumentType, version: document.version } },
    create: {
      type: input.type as LegalDocumentType,
      version: document.version,
      title: document.title,
      publicPath: document.publicPath,
      contentHash: getLegalDocumentContentHash(input.type),
      effectiveAt: new Date(`${document.effectiveDate}T00:00:00.000Z`),
    },
    update: {},
    select: { id: true, contentHash: true },
  });
  if (documentVersion.contentHash !== getLegalDocumentContentHash(input.type)) {
    throw new Error(`A versão ${document.version} de ${document.type} não corresponde ao conteúdo publicado.`);
  }

  return database.legalAcceptance.upsert({
    where: { idempotencyKey: evidenceKey(input) },
    create: {
      documentVersionId: documentVersion.id,
      context: input.context,
      userId: input.userId,
      guestId: input.guestId,
      organizationId: input.organizationId,
      contextReference: input.contextReference?.slice(0, 200),
      clientAcceptedAt: parsedClientAcceptedAt(input.clientAcceptedAt),
      ipAddress: sanitizedHeader(input.ipAddress, 45),
      userAgent: sanitizedHeader(input.userAgent, 512),
      contextSnapshot: input.contextSnapshot,
      idempotencyKey: evidenceKey(input),
    },
    update: {},
  });
}

export async function recordLegalAcceptances(inputs: AcceptanceInput[], database: Transaction | typeof prisma = prisma) {
  return Promise.all(inputs.map((input) => recordLegalAcceptance(input, database)));
}
