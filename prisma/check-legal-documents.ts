import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { legalDocumentList } from "../src/lib/legal/legal-documents";
import { getLegalDocumentContentHash } from "../src/server/legal/legal-acceptance.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não foi configurada.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  const rows = await prisma.legalDocumentVersion.findMany({ where: { active: true } });
  for (const document of legalDocumentList) {
    const row = rows.find((item) => item.type === document.type && item.version === document.version);
    if (!row) throw new Error(`Versão jurídica ausente: ${document.type}/${document.version}`);
    if (row.contentHash !== getLegalDocumentContentHash(document.type)) {
      throw new Error(`Hash jurídico divergente: ${document.type}/${document.version}. Publique uma nova versão.`);
    }
  }
  console.log(`${legalDocumentList.length} versões jurídicas ativas e válidas.`);
} finally {
  await prisma.$disconnect();
}
