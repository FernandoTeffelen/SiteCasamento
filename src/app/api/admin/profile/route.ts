import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getSessionTokenFromCookieHeader, requireAdminSession, updateAdminProfile } from "@/server/auth/admin-auth.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    const user = await requireAdminSession();
    const body = await request.json();
    const updated = await updateAdminProfile({
      userId: user.id,
      name: body.name,
      email: body.email,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
      preserveSessionToken: getSessionTokenFromCookieHeader(request.headers.get("cookie"), ADMIN_SESSION_COOKIE),
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}
