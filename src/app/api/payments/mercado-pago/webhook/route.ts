import { getMercadoPagoConfig } from "@/server/payments/mercado-pago.config";
import { verifyMercadoPagoSignature } from "@/server/payments/mercado-pago-signature";
import { createMercadoPagoWebhookDeliveryKey, receiveMercadoPagoSubscriptionWebhook, receiveMercadoPagoWebhook } from "@/server/payments/payment-checkout.service";
import { assertContentLengthWithinLimit, jsonError, readJsonBody } from "@/server/http/api-response";
import { DomainError } from "@/server/domain/error";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertContentLengthWithinLimit(request, 64 * 1024);
    const body = await readJsonBody(request);
    const bodyData = body.data && typeof body.data === "object" && !Array.isArray(body.data)
      ? body.data as Record<string, unknown>
      : null;
    const url = new URL(request.url);
    const dataId = url.searchParams.get("data.id") ?? (bodyData?.id === undefined ? "" : String(bodyData.id));
    const notificationType = typeof body.type === "string" ? body.type : url.searchParams.get("type");
    if (notificationType !== "payment" && notificationType !== "subscription_preapproval") return Response.json({ received: true, ignored: true });
    if (!dataId || dataId.length > 100) throw new DomainError("INVALID_WEBHOOK", 400, "Notificação inválida.");

    const config = getMercadoPagoConfig();
    const validSignature = verifyMercadoPagoSignature({
      signatureHeader: request.headers.get("x-signature"),
      requestId: request.headers.get("x-request-id"),
      dataId,
      secret: config.webhookSecret,
    });
    if (!validSignature) throw new DomainError("INVALID_WEBHOOK_SIGNATURE", 401, "Assinatura da notificação inválida.");

    const receipt = {
      providerPaymentId: dataId,
      notificationType,
      action: typeof body.action === "string" ? body.action : null,
      deliveryKey: createMercadoPagoWebhookDeliveryKey({
        providerPaymentId: dataId,
        requestId: request.headers.get("x-request-id"),
        signature: request.headers.get("x-signature"),
        action: typeof body.action === "string" ? body.action : null,
      }),
      payload: body as never,
    };
    const result = notificationType === "subscription_preapproval"
      ? await receiveMercadoPagoSubscriptionWebhook(receipt)
      : await receiveMercadoPagoWebhook(receipt);
    return Response.json({ received: true, ...result });
  } catch (error) {
    return jsonError(error);
  }
}
