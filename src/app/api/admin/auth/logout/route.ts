import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getSessionTokenFromCookieHeader, revokeAdminSession } from "@/server/auth/admin-auth.service";
import { shouldUseSecureCookies } from "@/server/config/runtime";
import { assertSameOriginRequest, jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    const token = getSessionTokenFromCookieHeader(request.headers.get("cookie"), ADMIN_SESSION_COOKIE);
    await revokeAdminSession(token).catch(() => undefined);
    const response = NextResponse.redirect(new URL("/app/login", request.url), 303);
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: "",
      httpOnly: true,
      sameSite: "lax",
      secure: shouldUseSecureCookies(),
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
