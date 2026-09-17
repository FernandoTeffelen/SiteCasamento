import { createHash, randomUUID } from "node:crypto";
import {
  LegalAcceptanceContext,
  PaymentAttemptStatus,
  PaymentProcessingStatus,
  PaymentProcessingTrigger,
  PaymentProductType,
  PaymentWebhookEventStatus,
  SubscriptionStatus,
  Prisma,
} from "@/generated/prisma/client";
import {
  activateOrganizationSubscriptionInTransaction,
  completeOneTimeCreditPurchaseInTransaction,
} from "@/server/billing/credit.service";
import { prisma } from "@/server/db/prisma";
import { DomainError, isDomainError } from "@/server/domain/error";
import { recordLegalAcceptance, type LegalEvidence } from "@/server/legal/legal-acceptance.service";
import { mercadoPagoGateway, type MercadoPagoGateway, type MercadoPagoPayment } from "@/server/payments/mercado-pago.client";

export type CheckoutSelection =
  | { kind: "subscription"; planId: string }
  | { kind: "credit-package"; packageId: string }
  | { kind: "credit-volume"; quantity: number };

type CreateCheckoutInput = LegalEvidence & {
  user: { id: string; email: string };
  selection: CheckoutSelection;
  checkoutRequestId: string;
  commercialTermsVersion: unknown;
  acceptedCommercialTerms: unknown;
};

type WebhookReceiptInput = {
  providerPaymentId: string;
  notificationType: string;
  action?: string | null;
  deliveryKey: string;
  payload: Prisma.InputJsonValue;
};

function assertCheckoutRequestId(value: string) {
  if (!/^[A-Za-z0-9_-]{16,100}$/.test(value)) {
    throw new DomainError("INVALID_CHECKOUT_KEY", 400, "Não foi possível identificar esta tentativa de compra.");
  }
}

function safePrice(priceCents: number | null) {
  if (!priceCents || !Number.isSafeInteger(priceCents) || priceCents < 1) {
    throw new DomainError("PRODUCT_WITHOUT_PRICE", 409, "Este produto ainda não possui um preço válido.");
  }
  return priceCents;
}

function retryableTransactionError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034");
}

async function withSerializableRetry<T>(operation: () => Promise<T>) {
  for (let index = 0; index < 3; index += 1) {
    try {
      return await operation();
    } catch (error) {
      if (retryableTransactionError(error) && index < 2) continue;
      throw error;
    }
  }
  throw new DomainError("PAYMENT_TRANSACTION_RETRY_EXHAUSTED", 409, "Não foi possível confirmar este pagamento agora.");
}

function errorDetails(error: unknown) {
  const code = isDomainError(error) ? error.code : "PAYMENT_PROCESSING_ERROR";
  const message = error instanceof Error ? error.message : "Falha desconhecida ao processar pagamento.";
  return { code: code.slice(0, 120), message: message.slice(0, 2_000) };
}

function nextRetryAt(processingCount: number) {
  const minutes = Math.min(60, 2 ** Math.min(processingCount, 6));
  return new Date(Date.now() + minutes * 60_000);
}

function mapProviderStatus(status: string) {
  if (status === "approved") return PaymentAttemptStatus.APPROVED;
  if (status === "rejected") return PaymentAttemptStatus.REJECTED;
  if (status === "cancelled") return PaymentAttemptStatus.CANCELED;
  if (status === "refunded" || status === "charged_back") return PaymentAttemptStatus.REFUNDED;
  return PaymentAttemptStatus.PENDING;
}

/** Cria a intenção interna e a preferência hospedada, sem conceder produto. */
export async function createMercadoPagoCheckout(
  input: CreateCheckoutInput,
  gateway: MercadoPagoGateway = mercadoPagoGateway,
) {
  assertCheckoutRequestId(input.checkoutRequestId);
  const membership = await prisma.organizationMembership.findFirst({
    where: { userId: input.user.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) throw new DomainError("ORGANIZATION_REQUIRED", 409, "Sua conta ainda não possui uma organização.");

  const existing = await prisma.paymentAttempt.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: membership.organizationId, idempotencyKey: input.checkoutRequestId } },
    select: { id: true, externalReference: true, checkoutUrl: true, providerPreferenceId: true, priceCents: true, currency: true },
  });
  if (existing?.checkoutUrl && existing.providerPreferenceId) return existing;

  const checkout = existing ?? await prisma.$transaction(async (transaction) => {
    let productType: PaymentProductType;
    let credits: number;
    let priceCents: number;
    let currency: string;
    let title: string;
    let subscriptionId: string | undefined;
    let purchaseId: string | undefined;
    let contextReference: string;
    let contextSnapshot: Prisma.InputJsonValue;

    if (input.selection.kind === "subscription") {
      const plan = await transaction.subscriptionPlan.findFirst({
        where: { id: input.selection.planId, active: true },
        select: { id: true, slug: true, name: true, tier: true, period: true, cycleMonths: true, creditsPerCycle: true, priceCents: true, currency: true },
      });
      if (!plan) throw new DomainError("PLAN_NOT_FOUND", 404, "O plano selecionado não está mais disponível.");
      priceCents = safePrice(plan.priceCents);
      credits = plan.creditsPerCycle;
      currency = plan.currency;
      title = `${plan.name} — ${plan.cycleMonths} mês(es)`;
      productType = PaymentProductType.SUBSCRIPTION_PLAN;
      subscriptionId = (await transaction.organizationSubscription.create({
        data: { organizationId: membership.organizationId, planId: plan.id, tier: plan.tier, period: plan.period, creditsPerCycle: plan.creditsPerCycle, cycleMonths: plan.cycleMonths },
        select: { id: true },
      })).id;
      contextReference = plan.id;
      contextSnapshot = { productType, planId: plan.id, slug: plan.slug, name: plan.name, tier: plan.tier, period: plan.period, cycleMonths: plan.cycleMonths, creditsPerCycle: plan.creditsPerCycle, priceCents, currency };
    } else if (input.selection.kind === "credit-package") {
      const creditPackage = await transaction.creditPackage.findFirst({
        where: { id: input.selection.packageId, active: true },
        select: { id: true, slug: true, name: true, credits: true, priceCents: true, currency: true },
      });
      if (!creditPackage) throw new DomainError("CREDIT_PACKAGE_NOT_FOUND", 404, "O pacote selecionado não está mais disponível.");
      priceCents = safePrice(creditPackage.priceCents);
      credits = creditPackage.credits;
      currency = creditPackage.currency;
      title = creditPackage.name;
      productType = PaymentProductType.CREDIT_PACKAGE;
      purchaseId = (await transaction.oneTimePurchase.create({
        data: { organizationId: membership.organizationId, creditPackageId: creditPackage.id, credits, priceCents, currency, idempotencyKey: `checkout:${input.checkoutRequestId}` },
        select: { id: true },
      })).id;
      contextReference = creditPackage.id;
      contextSnapshot = { productType, packageId: creditPackage.id, slug: creditPackage.slug, name: creditPackage.name, credits, priceCents, currency };
    } else {
      const quantity = input.selection.quantity;
      if (!Number.isSafeInteger(quantity) || quantity < 11 || quantity > 30) {
        throw new DomainError("INVALID_CREDIT_QUANTITY", 400, "Escolha entre 11 e 30 créditos.");
      }
      const volumeTier = await transaction.creditVolumeTier.findFirst({
        where: { active: true, minCredits: { lte: quantity }, maxCredits: { gte: quantity } },
        select: { id: true, slug: true, unitPriceCents: true, currency: true },
      });
      if (!volumeTier) throw new DomainError("CREDIT_VOLUME_NOT_FOUND", 404, "Não há uma faixa ativa para esta quantidade.");
      credits = quantity;
      priceCents = safePrice(volumeTier.unitPriceCents * quantity);
      currency = volumeTier.currency;
      title = `${quantity} créditos avulsos`;
      productType = PaymentProductType.CREDIT_VOLUME;
      purchaseId = (await transaction.oneTimePurchase.create({
        data: { organizationId: membership.organizationId, creditVolumeTierId: volumeTier.id, credits, priceCents, currency, idempotencyKey: `checkout:${input.checkoutRequestId}` },
        select: { id: true },
      })).id;
      contextReference = volumeTier.id;
      contextSnapshot = { productType, volumeTierId: volumeTier.id, slug: volumeTier.slug, quantity, unitPriceCents: volumeTier.unitPriceCents, priceCents, currency };
    }

    if (currency !== "BRL") throw new DomainError("UNSUPPORTED_CURRENCY", 409, "O checkout inicial aceita somente valores em reais.");
    const attemptId = randomUUID();
    const externalReference = `payment:${attemptId}`;
    const attempt = await transaction.paymentAttempt.create({
      data: { id: attemptId, organizationId: membership.organizationId, userId: input.user.id, subscriptionId, purchaseId, productType, credits, priceCents, currency, externalReference, idempotencyKey: input.checkoutRequestId },
      select: { id: true, externalReference: true, checkoutUrl: true, providerPreferenceId: true, priceCents: true, currency: true },
    });
    await recordLegalAcceptance({
      type: "COMMERCIAL_TERMS", version: input.commercialTermsVersion, accepted: input.acceptedCommercialTerms,
      context: LegalAcceptanceContext.CHECKOUT, userId: input.user.id, organizationId: membership.organizationId,
      contextReference, contextSnapshot, clientAcceptedAt: input.clientAcceptedAt, ipAddress: input.ipAddress, userAgent: input.userAgent,
    }, transaction);
    return { ...attempt, title };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const title = "title" in checkout && typeof checkout.title === "string" ? checkout.title : "Compra SiteCasamento";
  try {
    const preference = await gateway.createPreference({
      externalReference: checkout.externalReference, idempotencyKey: input.checkoutRequestId, title,
      priceCents: checkout.priceCents, currency: checkout.currency, payerEmail: input.user.email,
    });
    return prisma.paymentAttempt.update({
      where: { id: checkout.id },
      data: { status: PaymentAttemptStatus.PENDING, providerPreferenceId: preference.id, checkoutUrl: preference.checkoutUrl, lastErrorCode: null, lastErrorMessage: null },
      select: { id: true, externalReference: true, checkoutUrl: true, providerPreferenceId: true },
    });
  } catch (error) {
    const details = errorDetails(error);
    await prisma.paymentAttempt.update({ where: { id: checkout.id }, data: { status: PaymentAttemptStatus.ERROR, lastErrorCode: details.code, lastErrorMessage: details.message } }).catch(() => undefined);
    throw error;
  }
}

/** Cria uma assinatura recorrente no Mercado Pago. O provedor hospeda a coleta
 * de cartao/PIX conforme a configuracao da conta; nenhum dado sensivel passa
 * pela aplicacao. */
export async function createMercadoPagoSubscriptionCheckout(
  input: CreateCheckoutInput & { selection: Extract<CheckoutSelection, { kind: "subscription" }> },
  gateway: MercadoPagoGateway = mercadoPagoGateway,
) {
  assertCheckoutRequestId(input.checkoutRequestId);
  const membership = await prisma.organizationMembership.findFirst({ where: { userId: input.user.id }, orderBy: { createdAt: "asc" }, select: { organizationId: true } });
  if (!membership) throw new DomainError("ORGANIZATION_REQUIRED", 409, "Sua conta ainda não possui uma organização.");

  const existing = await prisma.paymentAttempt.findUnique({
    where: { organizationId_idempotencyKey: { organizationId: membership.organizationId, idempotencyKey: input.checkoutRequestId } },
    select: { id: true, externalReference: true, checkoutUrl: true, providerPreferenceId: true, subscription: { select: { providerSubscriptionId: true } } },
  });
  if (existing?.checkoutUrl && existing.subscription?.providerSubscriptionId) return existing;

  const checkout = await prisma.$transaction(async (transaction) => {
    const plan = await transaction.subscriptionPlan.findFirst({
      where: { id: input.selection.planId, active: true },
      select: { id: true, slug: true, name: true, tier: true, period: true, cycleMonths: true, creditsPerCycle: true, priceCents: true, currency: true },
    });
    if (!plan) throw new DomainError("PLAN_NOT_FOUND", 404, "O plano selecionado não está mais disponível.");
    const priceCents = safePrice(plan.priceCents);
    if (plan.currency !== "BRL") throw new DomainError("UNSUPPORTED_CURRENCY", 409, "O checkout inicial aceita somente valores em reais.");
    const subscription = await transaction.organizationSubscription.create({
      data: { organizationId: membership.organizationId, planId: plan.id, tier: plan.tier, period: plan.period, creditsPerCycle: plan.creditsPerCycle, cycleMonths: plan.cycleMonths, status: SubscriptionStatus.PENDING },
      select: { id: true },
    });
    const attemptId = randomUUID();
    const attempt = await transaction.paymentAttempt.create({
      data: { id: attemptId, organizationId: membership.organizationId, userId: input.user.id, subscriptionId: subscription.id, productType: PaymentProductType.SUBSCRIPTION_PLAN, credits: plan.creditsPerCycle, priceCents, currency: plan.currency, externalReference: `subscription:${attemptId}`, idempotencyKey: input.checkoutRequestId },
      select: { id: true, externalReference: true, priceCents: true, currency: true, subscriptionId: true },
    });
    await recordLegalAcceptance({ type: "COMMERCIAL_TERMS", version: input.commercialTermsVersion, accepted: input.acceptedCommercialTerms, context: LegalAcceptanceContext.CHECKOUT, userId: input.user.id, organizationId: membership.organizationId, contextReference: plan.id, contextSnapshot: { productType: PaymentProductType.SUBSCRIPTION_PLAN, planId: plan.id, slug: plan.slug, name: plan.name, tier: plan.tier, period: plan.period, cycleMonths: plan.cycleMonths, creditsPerCycle: plan.creditsPerCycle, priceCents, currency: plan.currency }, clientAcceptedAt: input.clientAcceptedAt, ipAddress: input.ipAddress, userAgent: input.userAgent }, transaction);
    return { ...attempt, title: `${plan.name} — ${plan.cycleMonths} mês(es)`, frequency: plan.cycleMonths };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  try {
    if (!gateway.createSubscription) throw new DomainError("PAYMENT_PROVIDER_ERROR", 502, "O checkout recorrente ainda não está disponível.");
    const subscription = await gateway.createSubscription({ externalReference: checkout.externalReference, reason: checkout.title, payerEmail: input.user.email, frequency: checkout.frequency, frequencyType: "months", transactionAmountCents: checkout.priceCents, currency: checkout.currency });
    await prisma.organizationSubscription.update({ where: { id: checkout.subscriptionId ?? "" }, data: { providerSubscriptionId: subscription.id, status: SubscriptionStatus.PENDING } });
    return prisma.paymentAttempt.update({ where: { id: checkout.id }, data: { status: PaymentAttemptStatus.PENDING, checkoutUrl: subscription.checkoutUrl, providerStatus: subscription.status, lastErrorCode: null, lastErrorMessage: null }, select: { id: true, externalReference: true, checkoutUrl: true } });
  } catch (error) {
    const details = errorDetails(error);
    await prisma.paymentAttempt.update({ where: { id: checkout.id }, data: { status: PaymentAttemptStatus.ERROR, lastErrorCode: details.code, lastErrorMessage: details.message } }).catch(() => undefined);
    throw error;
  }
}

export function createMercadoPagoWebhookDeliveryKey(input: {
  providerPaymentId: string;
  requestId: string | null;
  signature: string | null;
  action?: string | null;
}) {
  return createHash("sha256")
    .update([input.providerPaymentId, input.requestId ?? "", input.signature ?? "", input.action ?? ""].join("\n"))
    .digest("hex");
}

async function createOrFindWebhookEvent(input: WebhookReceiptInput) {
  const existing = await prisma.paymentWebhookEvent.findUnique({
    where: { deliveryKey: input.deliveryKey },
    select: { id: true, status: true },
  });
  if (existing) return { ...existing, created: false };
  try {
    const event = await prisma.paymentWebhookEvent.create({
      data: {
        providerPaymentId: input.providerPaymentId,
        notificationType: input.notificationType,
        action: input.action ?? null,
        deliveryKey: input.deliveryKey,
        signatureValid: true,
        payload: input.payload,
      },
      select: { id: true, status: true },
    });
    return { ...event, created: true };
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    const event = await prisma.paymentWebhookEvent.findUniqueOrThrow({ where: { deliveryKey: input.deliveryKey }, select: { id: true, status: true } });
    return { ...event, created: false };
  }
}

async function beginWebhookProcessing(eventId: string, trigger: PaymentProcessingTrigger) {
  return prisma.$transaction(async (transaction) => {
    const event = await transaction.paymentWebhookEvent.findUnique({
      where: { id: eventId },
      select: { id: true, status: true, providerPaymentId: true, paymentAttemptId: true },
    });
    if (!event) throw new DomainError("PAYMENT_WEBHOOK_EVENT_NOT_FOUND", 404, "Evento de pagamento não encontrado.");
    const completedAt = new Date();
    if (event.status === PaymentWebhookEventStatus.PROCESSED || event.status === PaymentWebhookEventStatus.IGNORED) {
      const processing = await transaction.paymentProcessingAttempt.create({
        data: { webhookEventId: event.id, paymentAttemptId: event.paymentAttemptId, trigger, status: PaymentProcessingStatus.SKIPPED, completedAt },
        select: { id: true },
      });
      return { skipped: true as const, event, processingId: processing.id };
    }
    const processing = await transaction.paymentProcessingAttempt.create({
      data: { webhookEventId: event.id, paymentAttemptId: event.paymentAttemptId, trigger },
      select: { id: true },
    });
    const updated = await transaction.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: PaymentWebhookEventStatus.PROCESSING, processingCount: { increment: 1 }, nextRetryAt: null },
      select: { processingCount: true },
    });
    return { skipped: false as const, event, processingId: processing.id, processingCount: updated.processingCount };
  });
}

async function recordWebhookProcessingFailure(input: { eventId: string; processingId: string; error: unknown }) {
  const details = errorDetails(input.error);
  await prisma.$transaction(async (transaction) => {
    const event = await transaction.paymentWebhookEvent.findUniqueOrThrow({
      where: { id: input.eventId },
      select: { paymentAttemptId: true, processingCount: true },
    });
    const retryAt = nextRetryAt(event.processingCount);
    await transaction.paymentProcessingAttempt.update({
      where: { id: input.processingId },
      data: { status: PaymentProcessingStatus.FAILED, errorCode: details.code, errorMessage: details.message, completedAt: new Date() },
    });
    await transaction.paymentWebhookEvent.update({
      where: { id: input.eventId },
      data: { status: PaymentWebhookEventStatus.FAILED, lastErrorCode: details.code, lastErrorMessage: details.message, nextRetryAt: retryAt },
    });
    if (event.paymentAttemptId) {
      await transaction.paymentAttempt.update({
        where: { id: event.paymentAttemptId },
        data: { lastErrorCode: details.code, lastErrorMessage: details.message },
      });
    }
  });
}

function paymentMatchesAttempt(payment: MercadoPagoPayment, attempt: {
  priceCents: number;
  currency: string;
  providerPreferenceId: string | null;
}) {
  return payment.transactionAmountCents === attempt.priceCents
    && payment.currency === attempt.currency
    && (!attempt.providerPreferenceId || payment.preferenceId === attempt.providerPreferenceId);
}

async function finalizeWebhookProcessing(input: { eventId: string; processingId: string; payment: MercadoPagoPayment }) {
  return withSerializableRetry(() => prisma.$transaction(async (transaction) => {
    const event = await transaction.paymentWebhookEvent.findUnique({
      where: { id: input.eventId },
      select: { id: true, status: true },
    });
    if (!event) throw new DomainError("PAYMENT_WEBHOOK_EVENT_NOT_FOUND", 404, "Evento de pagamento não encontrado.");
    const attempt = await transaction.paymentAttempt.findUnique({
      where: { externalReference: input.payment.externalReference },
      select: {
        id: true, organizationId: true, subscriptionId: true, purchaseId: true, status: true,
        priceCents: true, currency: true, providerPreferenceId: true,
      },
    });
    const now = new Date();
    if (!attempt) {
      await transaction.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: PaymentWebhookEventStatus.IGNORED, processedAt: now, lastErrorCode: null, lastErrorMessage: null },
      });
      await transaction.paymentProcessingAttempt.update({
        where: { id: input.processingId },
        data: { status: PaymentProcessingStatus.SKIPPED, completedAt: now },
      });
      return { ignored: true, reason: "unknown-reference", fulfilled: false } as const;
    }

    await transaction.paymentWebhookEvent.update({ where: { id: event.id }, data: { paymentAttemptId: attempt.id } });
    if (!paymentMatchesAttempt(input.payment, attempt)) {
      const details = { code: "PAYMENT_MISMATCH", message: "O pagamento consultado não corresponde ao pedido registrado no servidor." };
      await transaction.paymentAttempt.update({
        where: { id: attempt.id },
        data: { status: PaymentAttemptStatus.ERROR, providerStatus: input.payment.status, lastWebhookAt: now, lastErrorCode: details.code, lastErrorMessage: details.message },
      });
      await transaction.paymentWebhookEvent.update({
        where: { id: event.id },
        data: { status: PaymentWebhookEventStatus.FAILED, lastErrorCode: details.code, lastErrorMessage: details.message },
      });
      await transaction.paymentProcessingAttempt.update({
        where: { id: input.processingId },
        data: { paymentAttemptId: attempt.id, status: PaymentProcessingStatus.FAILED, errorCode: details.code, errorMessage: details.message, completedAt: now },
      });
      return { ignored: true, reason: "payment-mismatch", fulfilled: false } as const;
    }

    const status = mapProviderStatus(input.payment.status);
    if (attempt.status === PaymentAttemptStatus.APPROVED && status !== PaymentAttemptStatus.REFUNDED) {
      await transaction.paymentAttempt.update({ where: { id: attempt.id }, data: { lastWebhookAt: now, lastProcessedAt: now } });
      await transaction.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: PaymentWebhookEventStatus.PROCESSED, processedAt: now } });
      await transaction.paymentProcessingAttempt.update({
        where: { id: input.processingId },
        data: { paymentAttemptId: attempt.id, status: PaymentProcessingStatus.SKIPPED, completedAt: now },
      });
      return { ignored: false, fulfilled: false, status: attempt.status, duplicate: true } as const;
    }

    let fulfilled = false;
    if (status === PaymentAttemptStatus.APPROVED) {
      if (attempt.subscriptionId) {
        await activateOrganizationSubscriptionInTransaction({
          transaction,
          organizationId: attempt.organizationId,
          subscriptionId: attempt.subscriptionId,
        });
      } else if (attempt.purchaseId) {
        await transaction.oneTimePurchase.update({ where: { id: attempt.purchaseId }, data: { providerPaymentId: input.payment.id } });
        await completeOneTimeCreditPurchaseInTransaction({ transaction, organizationId: attempt.organizationId, purchaseId: attempt.purchaseId });
      } else {
        throw new Error("Payment attempt has no product relation.");
      }
      fulfilled = true;
    }

    await transaction.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status,
        providerPaymentId: input.payment.id,
        providerStatus: input.payment.status,
        lastWebhookAt: now,
        lastProcessedAt: now,
        processedAt: status === PaymentAttemptStatus.APPROVED ? now : undefined,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    await transaction.paymentWebhookEvent.update({
      where: { id: event.id },
      data: { status: PaymentWebhookEventStatus.PROCESSED, processedAt: now, nextRetryAt: null, lastErrorCode: null, lastErrorMessage: null },
    });
    await transaction.paymentProcessingAttempt.update({
      where: { id: input.processingId },
      data: { paymentAttemptId: attempt.id, status: PaymentProcessingStatus.SUCCEEDED, completedAt: now },
    });
    return { ignored: false, fulfilled, status, duplicate: false } as const;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
}

/** Processa uma entrega já registrada. Falhas de comunicação ficam pendentes para reprocessamento. */
export async function processMercadoPagoWebhookEvent(
  eventId: string,
  gateway: MercadoPagoGateway = mercadoPagoGateway,
  trigger: PaymentProcessingTrigger = PaymentProcessingTrigger.WEBHOOK,
) {
  const started = await beginWebhookProcessing(eventId, trigger);
  if (started.skipped) return { ignored: false, fulfilled: false, duplicate: true, status: "SKIPPED" as const };
  try {
    const payment = await gateway.getPayment(started.event.providerPaymentId);
    return await finalizeWebhookProcessing({ eventId, processingId: started.processingId, payment });
  } catch (error) {
    await recordWebhookProcessingFailure({ eventId, processingId: started.processingId, error }).catch(() => undefined);
    throw error;
  }
}

/** Registra a entrega autenticada e inicia seu processamento idempotente. */
export async function receiveMercadoPagoWebhook(input: WebhookReceiptInput, gateway: MercadoPagoGateway = mercadoPagoGateway) {
  const event = await createOrFindWebhookEvent(input);
  const result = await processMercadoPagoWebhookEvent(event.id, gateway, PaymentProcessingTrigger.WEBHOOK);
  return { eventId: event.id, deliveryCreated: event.created, ...result };
}

/** Atualiza o estado da assinatura apos notificacoes subscription_preapproval. */
export async function receiveMercadoPagoSubscriptionWebhook(input: WebhookReceiptInput, gateway: MercadoPagoGateway = mercadoPagoGateway) {
  const event = await createOrFindWebhookEvent(input);
  if (!event.created || event.status === PaymentWebhookEventStatus.PROCESSED || event.status === PaymentWebhookEventStatus.IGNORED) return { eventId: event.id, deliveryCreated: event.created, duplicate: true };
  try {
    if (!gateway.getSubscription) throw new DomainError("PAYMENT_PROVIDER_ERROR", 502, "O webhook recorrente ainda não está disponível.");
    const provider = await gateway.getSubscription(input.providerPaymentId);
    const result = await withSerializableRetry(() => prisma.$transaction(async (transaction) => {
      const attempt = await transaction.paymentAttempt.findFirst({ where: { subscription: { providerSubscriptionId: provider.id } }, select: { id: true, organizationId: true, subscriptionId: true } });
      if (!attempt?.subscriptionId) {
        await transaction.paymentWebhookEvent.update({ where: { id: event.id }, data: { status: PaymentWebhookEventStatus.IGNORED, processedAt: new Date() } });
        return { ignored: true, status: provider.status };
      }
      const normalized = provider.status.toLowerCase();
      const subscriptionStatus = normalized === "authorized" || normalized === "active" ? SubscriptionStatus.ACTIVE : normalized === "cancelled" || normalized === "canceled" ? SubscriptionStatus.CANCELED : normalized === "paused" ? SubscriptionStatus.PAST_DUE : SubscriptionStatus.PENDING;
      if (subscriptionStatus === SubscriptionStatus.ACTIVE) await activateOrganizationSubscriptionInTransaction({ transaction, organizationId: attempt.organizationId, subscriptionId: attempt.subscriptionId });
      else await transaction.organizationSubscription.update({ where: { id: attempt.subscriptionId }, data: { status: subscriptionStatus, canceledAt: subscriptionStatus === SubscriptionStatus.CANCELED ? new Date() : undefined } });
      await transaction.paymentAttempt.update({ where: { id: attempt.id }, data: { status: subscriptionStatus === SubscriptionStatus.ACTIVE ? PaymentAttemptStatus.APPROVED : subscriptionStatus === SubscriptionStatus.CANCELED ? PaymentAttemptStatus.CANCELED : PaymentAttemptStatus.PENDING, providerStatus: provider.status, lastWebhookAt: new Date(), lastProcessedAt: new Date(), processedAt: subscriptionStatus === SubscriptionStatus.ACTIVE ? new Date() : undefined } });
      await transaction.paymentWebhookEvent.update({ where: { id: event.id }, data: { paymentAttemptId: attempt.id, status: PaymentWebhookEventStatus.PROCESSED, processedAt: new Date() } });
      return { ignored: false, status: provider.status };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }));
    return { eventId: event.id, deliveryCreated: event.created, ...result };
  } catch (error) {
    await recordWebhookProcessingFailure({ eventId: event.id, processingId: (await prisma.paymentProcessingAttempt.create({ data: { webhookEventId: event.id, trigger: PaymentProcessingTrigger.WEBHOOK }, select: { id: true } })).id, error }).catch(() => undefined);
    throw error;
  }
}

/** Reprocessamento explícito de uma entrega que falhou, sem confiar no payload antigo. */
export async function reprocessMercadoPagoWebhookEvent(eventId: string, gateway: MercadoPagoGateway = mercadoPagoGateway) {
  return processMercadoPagoWebhookEvent(eventId, gateway, PaymentProcessingTrigger.MANUAL_REPROCESS);
}

/** Compatibilidade para testes e tarefas internas: cria um evento rastreável e consulta o provedor. */
export async function processMercadoPagoPaymentNotification(paymentId: string, gateway: MercadoPagoGateway = mercadoPagoGateway) {
  const deliveryKey = createMercadoPagoWebhookDeliveryKey({ providerPaymentId: paymentId, requestId: randomUUID(), signature: "internal", action: "manual" });
  return receiveMercadoPagoWebhook({
    providerPaymentId: paymentId,
    notificationType: "payment",
    action: "manual",
    deliveryKey,
    payload: { source: "internal-process-request" },
  }, gateway);
}
