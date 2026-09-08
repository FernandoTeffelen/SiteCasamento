import { NextResponse } from "next/server";
import { getSessionTokenFromCookieHeader, PLATFORM_SESSION_COOKIE, revokeAdminSession } from "@/server/auth/admin-auth.service";
import { shouldUseSecureCookies } from "@/server/config/runtime";
import { assertSameOriginRequest, jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    const token = getSessionTokenFromCookieHeader(request.headers.get("cookie"), PLATFORM_SESSION_COOKIE);
    // Encerrar a sessão local é seguro mesmo se o banco estiver temporariamente indisponível.
    await revokeAdminSession(token).catch(() => undefined);
    const response = NextResponse.redirect(new URL("/gestao-interna/login", request.url), 303);
    response.cookies.set({
      name: PLATFORM_SESSION_COOKIE,
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
