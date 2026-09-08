import { NextResponse } from "next/server";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError } from "@/server/http/api-response";
import { updatePlatformManualAccessPlanStatus } from "@/server/platform/platform-dashboard.service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string; planId: string }> },
) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    const user = await requirePlatformAdministrator();
    const { customerId, planId } = await params;
    const formData = await request.formData();
    await updatePlatformManualAccessPlanStatus({
      userId: user.id,
      customerId,
      planId,
      status: formData.get("status"),
    });
    return NextResponse.redirect(new URL(`/gestao-interna/clientes/${customerId}`, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
