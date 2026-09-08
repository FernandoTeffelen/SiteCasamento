import { NextResponse } from "next/server";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError } from "@/server/http/api-response";
import { updatePlatformCustomerStatus } from "@/server/platform/platform-dashboard.service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    const user = await requirePlatformAdministrator();
    const { customerId } = await params;
    const formData = await request.formData();
    await updatePlatformCustomerStatus({
      userId: user.id,
      customerId,
      accountStatus: formData.get("accountStatus"),
    });
    return NextResponse.redirect(new URL(`/gestao-interna/clientes/${customerId}`, request.url), 303);
  } catch (error) {
    return jsonError(error);
  }
}
