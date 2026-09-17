import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { DomainError } from "@/server/domain/error";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError, readJsonBody } from "@/server/http/api-response";
import { assertRequestRateLimit, getRequestClientIp } from "@/server/http/rate-limit";
import { createMercadoPagoSubscriptionCheckout } from "@/server/payments/payment-checkout.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    assertRequestRateLimit(request, { namespace: "payment-subscription", limit: 10, windowMs: 60_000 });
    const user = await requireAdminSession();
    const body = await readJsonBody(request);
    if (typeof body.planId !== "string" || typeof body.checkoutRequestId !== "string") throw new DomainError("INVALID_SUBSCRIPTION", 400, "Assinatura inválida.");
    const checkout = await createMercadoPagoSubscriptionCheckout({
      user: { id: user.id, email: user.email },
      selection: { kind: "subscription", planId: body.planId },
      checkoutRequestId: body.checkoutRequestId,
      commercialTermsVersion: body.commercialTermsVersion,
      acceptedCommercialTerms: body.acceptedCommercialTerms,
      clientAcceptedAt: typeof body.clientAcceptedAt === "string" ? body.clientAcceptedAt : null,
      ipAddress: getRequestClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });
    if (!checkout.checkoutUrl) throw new DomainError("CHECKOUT_URL_UNAVAILABLE", 502, "O Mercado Pago não forneceu o endereço do checkout.");
    return Response.json({ checkoutUrl: checkout.checkoutUrl }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
