import { NextResponse } from "next/server";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { assertSameOriginRequest, jsonError } from "@/server/http/api-response";
import { deletePlatformCustomer } from "@/server/platform/platform-dashboard.service";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ customerId: string }> },
) {
  try {
    assertSameOriginRequest(request);
    const user = await requirePlatformAdministrator();
    const { customerId } = await params;
    await deletePlatformCustomer({ userId: user.id, customerId });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return jsonError(error);
  }
}
