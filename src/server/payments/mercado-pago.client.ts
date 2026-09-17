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

export type MercadoPagoSubscriptionInput = {
  externalReference: string;
  reason: string;
  payerEmail: string;
  frequency: number;
  frequencyType: "months";
  transactionAmountCents: number;
  currency: string;
};

export type MercadoPagoSubscription = {
  id: string;
  status: string;
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
  createSubscription?(input: MercadoPagoSubscriptionInput): Promise<MercadoPagoSubscription>;
  getSubscription?(subscriptionId: string): Promise<{ id: string; status: string; externalReference: string | null }>;
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

async function mercadoPagoSubscriptionRequest(init?: RequestInit) {
  const config = getMercadoPagoConfig();
  const response = await fetch("https://api.mercadopago.com/preapproval", {
    ...init,
    headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new DomainError("PAYMENT_PROVIDER_ERROR", 502, "O Mercado Pago não respondeu como esperado. Tente novamente.");
  return response.json() as Promise<Record<string, unknown>>;
}

// Mercado Pago subscription creation endpoint: https://api.mercadopago.com/preapproval
// The amount and recurrence are always derived from the trustedOffer loaded by the server.

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
        ...(config.isPublicHttpsUrl ? { auto_return: "approved" } : {}),
        ...(config.isPublicHttpsUrl ? { notification_url: `${config.publicBaseUrl}/api/payments/mercado-pago/webhook` } : {}),
        statement_descriptor: "SITECASAMENTO",
        metadata: { payment_attempt_reference: input.externalReference },
      }),
    });
    const normalUrl = requiredString(payload.init_point, "init_point");
    return {
      id: requiredString(payload.id, "preference id"),
      checkoutUrl: normalUrl,
    };
  },

  async createSubscription(input) {
    const config = getMercadoPagoConfig();
    const payload = await mercadoPagoSubscriptionRequest({
      method: "POST",
      body: JSON.stringify({
        reason: input.reason.slice(0, 120),
        external_reference: input.externalReference,
        payer_email: input.payerEmail,
        auto_recurring: {
          frequency: input.frequency,
          frequency_type: input.frequencyType,
          transaction_amount: input.transactionAmountCents / 100,
          currency_id: input.currency,
        },
        back_url: `${config.publicBaseUrl}/pagamento/retorno`,
        status: "pending",
      }),
    });
    return {
      id: requiredString(payload.id, "subscription id"),
      status: typeof payload.status === "string" ? payload.status : "pending",
      checkoutUrl: requiredString(payload.init_point, "subscription init_point"),
    };
  },

  async getSubscription(subscriptionId) {
    const payload = await mercadoPagoRequest(`/preapproval/${encodeURIComponent(subscriptionId)}`);
    return {
      id: requiredString(payload.id, "subscription id"),
      status: requiredString(payload.status, "subscription status"),
      externalReference: typeof payload.external_reference === "string" ? payload.external_reference : null,
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
