import { DomainError } from "@/server/domain/error";

type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret: string;
  publicBaseUrl: string;
  isPublicHttpsUrl: boolean;
};

function configuredValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isMercadoPagoConfigured() {
  return Boolean(
    configuredValue("MERCADO_PAGO_ACCESS_TOKEN")
    && configuredValue("MERCADO_PAGO_PUBLIC_BASE_URL"),
  );
}

export function getMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = configuredValue("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = configuredValue("MERCADO_PAGO_WEBHOOK_SECRET");
  const rawPublicBaseUrl = configuredValue("MERCADO_PAGO_PUBLIC_BASE_URL") || configuredValue("APP_URL") || "http://localhost:3000";
  if (!accessToken) {
    throw new DomainError(
      "MERCADO_PAGO_NOT_CONFIGURED",
      503,
      "O checkout do Mercado Pago ainda não foi configurado.",
    );
  }

  let publicBaseUrl: URL;
  try {
    publicBaseUrl = new URL(rawPublicBaseUrl);
  } catch {
    throw new Error("MERCADO_PAGO_PUBLIC_BASE_URL is invalid.");
  }
  if (publicBaseUrl.pathname !== "/" || publicBaseUrl.search || publicBaseUrl.hash) {
    throw new Error("MERCADO_PAGO_PUBLIC_BASE_URL must contain only an origin.");
  }
  const isLocalhost = ["localhost", "127.0.0.1", "::1"].includes(publicBaseUrl.hostname);
  const isPublicHttpsUrl = publicBaseUrl.protocol === "https:" && !isLocalhost;
  if (!isLocalhost && !isPublicHttpsUrl) throw new Error("MERCADO_PAGO_PUBLIC_BASE_URL must use HTTPS outside local development.");
  if (process.env.NODE_ENV === "production" && !isPublicHttpsUrl) throw new Error("MERCADO_PAGO_PUBLIC_BASE_URL must use a public HTTPS origin in production.");

  return {
    accessToken,
    webhookSecret,
    publicBaseUrl: publicBaseUrl.origin,
    isPublicHttpsUrl,
  };
}
