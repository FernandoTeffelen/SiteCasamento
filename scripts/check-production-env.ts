import "dotenv/config";

const errors: string[] = [];
const warnings: string[] = [];

function requireValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} precisa estar configurada.`);
  return value;
}

function parseUrl(name: string, value: string | undefined) {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    errors.push(`${name} precisa ser uma URL válida.`);
    return null;
  }
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

if (process.env.NODE_ENV !== "production") {
  errors.push("NODE_ENV precisa ser production para esta verificação.");
}

const appUrl = parseUrl("APP_URL", requireValue("APP_URL"));
if (appUrl) {
  if (appUrl.protocol !== "https:") errors.push("APP_URL precisa usar HTTPS em produção.");
  if (appUrl.pathname !== "/" || appUrl.search || appUrl.hash) {
    errors.push("APP_URL deve conter somente protocolo e domínio.");
  }
  if (isLocalHost(appUrl.hostname)) errors.push("APP_URL não pode apontar para localhost em produção.");
}

const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (configuredOrigins.length === 0) {
  errors.push("ALLOWED_ORIGINS precisa conter o domínio HTTPS oficial.");
} else if (appUrl && !configuredOrigins.includes(appUrl.origin)) {
  errors.push("ALLOWED_ORIGINS precisa incluir a origem de APP_URL.");
}

if (process.env.TRUST_PROXY !== "true") errors.push("TRUST_PROXY precisa ser true atrás do proxy de produção.");
if (process.env.COOKIE_SECURE !== "true") errors.push("COOKIE_SECURE precisa ser true em produção.");

const databaseUrl = parseUrl("DATABASE_URL", requireValue("DATABASE_URL"));
if (databaseUrl) {
  if (!/^postgres(?:ql)?:$/.test(databaseUrl.protocol)) errors.push("DATABASE_URL precisa usar PostgreSQL.");
  if (isLocalHost(databaseUrl.hostname)) errors.push("DATABASE_URL não pode apontar para localhost em produção.");
}

if (process.env.STORAGE_DRIVER !== "s3-compatible") {
  errors.push("STORAGE_DRIVER precisa ser s3-compatible em produção.");
}
for (const name of ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"]) requireValue(name);

const maxUploadBytes = Number(process.env.MAX_UPLOAD_BYTES);
const absoluteMaxUploadBytes = 25 * 1024 * 1024;
if (!Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1 || maxUploadBytes > absoluteMaxUploadBytes) {
  errors.push(`MAX_UPLOAD_BYTES precisa ser um inteiro entre 1 e ${absoluteMaxUploadBytes}.`);
}

const adminEmail = requireValue("PLATFORM_ADMIN_EMAIL");
const adminPassword = requireValue("PLATFORM_ADMIN_PASSWORD");
if (adminEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
  errors.push("PLATFORM_ADMIN_EMAIL precisa ser um e-mail válido.");
}
if (adminPassword && adminPassword.length < 6) {
  errors.push("PLATFORM_ADMIN_PASSWORD precisa ter pelo menos 6 caracteres.");
}

if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
  warnings.push("Sentry não configurado: erros de produção não terão monitoramento externo.");
}
if (!process.env.SENTRY_AUTH_TOKEN) {
  warnings.push("SENTRY_AUTH_TOKEN ausente: source maps não serão enviados no build.");
}

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERRO: ${error}`);
  process.exitCode = 1;
} else {
  console.log("Configuração de produção aprovada.");
}
