import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { syncLegalDocuments } from "../src/server/legal/legal-acceptance.service";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não foi configurada.");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });

try {
  await syncLegalDocuments(prisma);
  console.log("Versões dos documentos jurídicos sincronizadas.");
} finally {
  await prisma.$disconnect();
}
