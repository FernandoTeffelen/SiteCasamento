import { DomainError } from "@/server/domain/error";

type MercadoPagoConfig = {
  accessToken: string;
  webhookSecret: string;
  publicBaseUrl: string;
  useSandboxCheckoutUrl: boolean;
};

function configuredValue(name: string) {
  return process.env[name]?.trim() ?? "";
}

export function isMercadoPagoConfigured() {
  return Boolean(
    configuredValue("MERCADO_PAGO_ACCESS_TOKEN")
    && configuredValue("MERCADO_PAGO_WEBHOOK_SECRET")
    && configuredValue("MERCADO_PAGO_PUBLIC_BASE_URL"),
  );
}

export function getMercadoPagoConfig(): MercadoPagoConfig {
  const accessToken = configuredValue("MERCADO_PAGO_ACCESS_TOKEN");
  const webhookSecret = configuredValue("MERCADO_PAGO_WEBHOOK_SECRET");
  const rawPublicBaseUrl = configuredValue("MERCADO_PAGO_PUBLIC_BASE_URL");
  if (!accessToken || !webhookSecret || !rawPublicBaseUrl) {
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
  if (publicBaseUrl.protocol !== "https:" || publicBaseUrl.pathname !== "/" || publicBaseUrl.search || publicBaseUrl.hash) {
    throw new Error("MERCADO_PAGO_PUBLIC_BASE_URL must contain only a public HTTPS origin.");
  }
  if (["localhost", "127.0.0.1", "::1"].includes(publicBaseUrl.hostname)) {
    throw new Error("MERCADO_PAGO_PUBLIC_BASE_URL cannot point to localhost.");
  }

  return {
    accessToken,
    webhookSecret,
    publicBaseUrl: publicBaseUrl.origin,
    useSandboxCheckoutUrl: process.env.MERCADO_PAGO_USE_SANDBOX !== "false",
  };
}
