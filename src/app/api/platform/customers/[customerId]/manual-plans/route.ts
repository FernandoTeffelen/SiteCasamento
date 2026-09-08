import { NextResponse } from "next/server";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError } from "@/server/http/api-response";
import { createPlatformManualAccessPlan } from "@/server/platform/platform-dashboard.service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ customerId: string }> }) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    const user = await requirePlatformAdministrator();
    const { customerId } = await params;
    const formData = await request.formData();
    await createPlatformManualAccessPlan({
      userId: user.id,
      customerId,
      organizationId: formData.get("organizationId") as string,
      durationMonths: formData.get("durationMonths"),
      creditsPerMonth: formData.get("creditsPerMonth"),
      startDate: formData.get("startDate"),
      status: formData.get("status"),
      adjustmentMode: formData.get("adjustmentMode"),
    });
    return NextResponse.redirect(new URL(`/gestao-interna/clientes/${customerId}`, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
