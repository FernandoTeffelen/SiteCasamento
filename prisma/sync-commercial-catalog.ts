import "dotenv/config";
import { prisma } from "../src/server/db/prisma";
import { syncCommercialCatalog } from "../src/server/billing/commercial-catalog.sync";

async function main() {
  await syncCommercialCatalog(prisma);
  console.log("Catálogo comercial sincronizado com sucesso.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
