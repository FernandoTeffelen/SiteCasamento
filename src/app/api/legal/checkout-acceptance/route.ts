import { LegalAcceptanceContext } from "@/generated/prisma/client";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError, readJsonBody } from "@/server/http/api-response";
import { getRequestClientIp, assertRequestRateLimit } from "@/server/http/rate-limit";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { prisma } from "@/server/db/prisma";
import { DomainError } from "@/server/domain/error";
import { recordLegalAcceptance } from "@/server/legal/legal-acceptance.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    assertRequestRateLimit(request, { namespace: "commercial-acceptance", limit: 20, windowMs: 60_000 });
    const user = await requireAdminSession();
    const body = await readJsonBody(request);
    if (typeof body.planId !== "string") throw new DomainError("PLAN_REQUIRED", 400, "Selecione um plano válido.");

    const [plan, membership] = await Promise.all([
      prisma.subscriptionPlan.findFirst({
        where: { id: body.planId, active: true, priceCents: { not: null } },
        select: { id: true, slug: true, name: true, tier: true, period: true, cycleMonths: true, creditsPerCycle: true, priceCents: true, currency: true },
      }),
      prisma.organizationMembership.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { organizationId: true },
      }),
    ]);
    if (!plan || plan.priceCents === null) throw new DomainError("PLAN_NOT_FOUND", 404, "O plano selecionado não está mais disponível.");
    if (!membership) throw new DomainError("ORGANIZATION_REQUIRED", 409, "Sua conta ainda não possui uma organização.");

    const acceptance = await recordLegalAcceptance({
      type: "COMMERCIAL_TERMS",
      version: body.commercialTermsVersion,
      accepted: body.acceptedCommercialTerms,
      context: LegalAcceptanceContext.CHECKOUT,
      userId: user.id,
      organizationId: membership.organizationId,
      contextReference: plan.id,
      contextSnapshot: {
        planId: plan.id,
        slug: plan.slug,
        name: plan.name,
        tier: plan.tier,
        period: plan.period,
        cycleMonths: plan.cycleMonths,
        creditsPerCycle: plan.creditsPerCycle,
        priceCents: plan.priceCents,
        currency: plan.currency,
      },
      clientAcceptedAt: typeof body.clientAcceptedAt === "string" ? body.clientAcceptedAt : null,
      ipAddress: getRequestClientIp(request),
      userAgent: request.headers.get("user-agent"),
    });

    return Response.json({ acceptance: { acceptedAt: acceptance.acceptedAt.toISOString() } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
