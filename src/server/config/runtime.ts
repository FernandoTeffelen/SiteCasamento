import { DomainError } from "@/server/domain/error";

function parsePositiveInteger(value: string | undefined, fallback: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) return fallback;
  return parsed;
}

export function getSessionDurationMs() {
  const days = parsePositiveInteger(process.env.SESSION_TTL_DAYS, 30, 90);
  return days * 24 * 60 * 60 * 1000;
}

export function shouldUseSecureCookies() {
  return process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";
}

export function getPublicApplicationOrigin(request: Request) {
  const configuredUrl = process.env.APP_URL?.trim();
  if (configuredUrl) {
    try {
      const url = new URL(configuredUrl);
      if (url.pathname !== "/" || url.search || url.hash) {
        throw new Error("APP_URL must contain only the scheme, host and optional port.");
      }
      if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
        throw new Error("APP_URL must use HTTPS in production.");
      }
      return url.origin;
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("APP_URL")) throw error;
      throw new Error("APP_URL is invalid.");
    }
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("APP_URL must be configured in production.");
  }
  return new URL(request.url).origin;
}

function getConfiguredOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => origin !== null);
}

export function assertAllowedRequestOrigin(
  request: Request,
  options: { required?: boolean; originOverride?: string | null } = {},
) {
  const origin = options.originOverride ?? request.headers.get("origin");
  if (!origin) {
    if (options.required) {
      throw new DomainError("CROSS_ORIGIN_REQUEST", 403, "A solicitaÃ§Ã£o foi bloqueada por seguranÃ§a.");
    }
    return;
  }

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(origin).origin;
  } catch {
    throw new DomainError("CROSS_ORIGIN_REQUEST", 403, "A solicitação foi bloqueada por segurança.");
  }

  const allowedOrigins = new Set([getPublicApplicationOrigin(request), ...getConfiguredOrigins()]);
  if (!allowedOrigins.has(normalizedOrigin)) {
    throw new DomainError("CROSS_ORIGIN_REQUEST", 403, "A solicitação foi bloqueada por segurança.");
  }
}

export function getTrustedProxy() {
  return process.env.TRUST_PROXY === "true";
}

export function getDatabasePoolConfig() {
  return {
    max: parsePositiveInteger(process.env.DATABASE_POOL_MAX, 10, 100),
    connectionTimeoutMillis: parsePositiveInteger(process.env.DATABASE_CONNECTION_TIMEOUT_MS, 10_000, 120_000),
  };
}

export function getDemoAdminPassword() {
  if (process.env.NODE_ENV === "production") return null;
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password) {
    throw new Error("DEMO_ADMIN_PASSWORD must be configured for the local demo account.");
  }
  return password;
}
