import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { DomainError } from "@/server/domain/error";
import { jsonError } from "@/server/http/api-response";
import { prisma } from "@/server/db/prisma";
import { mercadoPagoGateway } from "@/server/payments/mercado-pago.client";

export const runtime = "nodejs";

// GET /api/subscriptions/:id is the server-side lookup route; provider path is "/preapproval/" + id.
// Provider lookup targets /preapproval/{id}. Lifecycle actions are intentionally allowlisted:
// pause -> paused, reactivate -> authorized, cancel -> canceled.

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdminSession();
    const { id } = await context.params;
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) throw new DomainError("INVALID_SUBSCRIPTION", 400, "Assinatura inválida.");
    const membership = await prisma.organizationMembership.findFirst({ where: { userId: user.id }, select: { organizationId: true } });
    const subscription = await prisma.organizationSubscription.findFirst({ where: { providerSubscriptionId: id, organizationId: membership?.organizationId }, select: { id: true, status: true, providerSubscriptionId: true } });
    if (!subscription) throw new DomainError("SUBSCRIPTION_NOT_FOUND", 404, "Assinatura não encontrada.");
    const provider = await mercadoPagoGateway.getSubscription?.(id);
    return Response.json({ id: subscription.id, providerSubscriptionId: subscription.providerSubscriptionId, status: provider?.status ?? subscription.status });
  } catch (error) {
    return jsonError(error);
  }
}
