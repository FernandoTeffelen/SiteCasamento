import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { DomainError } from "@/server/domain/error";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError, readJsonBody } from "@/server/http/api-response";
import { assertRequestRateLimit, getRequestClientIp } from "@/server/http/rate-limit";
import { createMercadoPagoCheckout, type CheckoutSelection } from "@/server/payments/payment-checkout.service";

export const runtime = "nodejs";

function parseSelection(value: unknown): CheckoutSelection {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new DomainError("PRODUCT_REQUIRED", 400, "Selecione um produto.");
  const selection = value as Record<string, unknown>;
  if (selection.kind === "subscription" && typeof selection.planId === "string") return { kind: "subscription", planId: selection.planId };
  if (selection.kind === "credit-package" && typeof selection.packageId === "string") return { kind: "credit-package", packageId: selection.packageId };
  if (selection.kind === "credit-volume" && typeof selection.quantity === "number") return { kind: "credit-volume", quantity: selection.quantity };
  throw new DomainError("INVALID_PRODUCT", 400, "O produto selecionado é inválido.");
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    assertRequestRateLimit(request, { namespace: "payment-checkout", limit: 10, windowMs: 60_000 });
    const user = await requireAdminSession();
    const body = await readJsonBody(request);
    if (typeof body.checkoutRequestId !== "string") throw new DomainError("CHECKOUT_KEY_REQUIRED", 400, "Tentativa de compra inválida.");
    const checkout = await createMercadoPagoCheckout({
      user: { id: user.id, email: user.email },
      selection: parseSelection(body.selection),
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
