import "dotenv/config";
import { provisionPlatformAdministrator } from "../src/server/auth/admin-auth.service";

async function main() {
  const email = process.env.PLATFORM_ADMIN_EMAIL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD;
  const name = process.env.PLATFORM_ADMIN_NAME;

  if (!email || !password) {
    throw new Error("Defina PLATFORM_ADMIN_EMAIL e PLATFORM_ADMIN_PASSWORD no arquivo .env antes de continuar.");
  }

  const user = await provisionPlatformAdministrator({ email, password, name });
  console.log(`Administrador da plataforma provisionado: ${user.email}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
