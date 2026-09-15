import { DomainError } from "@/server/domain/error";
import { getMercadoPagoConfig } from "@/server/payments/mercado-pago.config";

const MERCADO_PAGO_API = "https://api.mercadopago.com";

export type MercadoPagoPreferenceInput = {
  externalReference: string;
  idempotencyKey: string;
  title: string;
  priceCents: number;
  currency: string;
  payerEmail: string;
};

export type MercadoPagoPreference = {
  id: string;
  checkoutUrl: string;
};

export type MercadoPagoPayment = {
  id: string;
  status: string;
  externalReference: string;
  preferenceId: string | null;
  transactionAmountCents: number;
  currency: string;
};

export type MercadoPagoGateway = {
  createPreference(input: MercadoPagoPreferenceInput): Promise<MercadoPagoPreference>;
  getPayment(paymentId: string): Promise<MercadoPagoPayment>;
};

async function mercadoPagoRequest(path: string, init?: RequestInit) {
  const config = getMercadoPagoConfig();
  const response = await fetch(`${MERCADO_PAGO_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    console.error("Mercado Pago API request failed", { path, status: response.status });
    throw new DomainError("PAYMENT_PROVIDER_ERROR", 502, "O Mercado Pago não respondeu como esperado. Tente novamente.");
  }
  return response.json() as Promise<Record<string, unknown>>;
}

function requiredString(value: unknown, field: string) {
  if (typeof value !== "string" || !value) throw new Error(`Mercado Pago returned an invalid ${field}.`);
  return value;
}

export const mercadoPagoGateway: MercadoPagoGateway = {
  async createPreference(input) {
    const config = getMercadoPagoConfig();
    const returnUrl = `${config.publicBaseUrl}/pagamento/retorno`;
    const payload = await mercadoPagoRequest("/checkout/preferences", {
      method: "POST",
      headers: { "X-Idempotency-Key": input.idempotencyKey },
      body: JSON.stringify({
        items: [{
          id: input.externalReference,
          title: input.title.slice(0, 120),
          quantity: 1,
          currency_id: input.currency,
          unit_price: input.priceCents / 100,
        }],
        payer: { email: input.payerEmail },
        external_reference: input.externalReference,
        back_urls: {
          success: `${returnUrl}?result=success`,
          pending: `${returnUrl}?result=pending`,
          failure: `${returnUrl}?result=failure`,
        },
        auto_return: "approved",
        notification_url: `${config.publicBaseUrl}/api/payments/mercado-pago/webhook`,
        statement_descriptor: "SITECASAMENTO",
        metadata: { payment_attempt_reference: input.externalReference },
      }),
    });
    const normalUrl = requiredString(payload.init_point, "init_point");
    const sandboxUrl = typeof payload.sandbox_init_point === "string" ? payload.sandbox_init_point : normalUrl;
    return {
      id: requiredString(payload.id, "preference id"),
      checkoutUrl: config.useSandboxCheckoutUrl ? sandboxUrl : normalUrl,
    };
  },

  async getPayment(paymentId) {
    const payload = await mercadoPagoRequest(`/v1/payments/${encodeURIComponent(paymentId)}`);
    const transactionAmount = Number(payload.transaction_amount);
    if (!Number.isFinite(transactionAmount)) throw new Error("Mercado Pago returned an invalid transaction amount.");
    return {
      id: String(payload.id),
      status: requiredString(payload.status, "payment status"),
      externalReference: requiredString(payload.external_reference, "external reference"),
      preferenceId: typeof payload.preference_id === "string" ? payload.preference_id : null,
      transactionAmountCents: Math.round(transactionAmount * 100),
      currency: requiredString(payload.currency_id, "currency"),
    };
  },
};
