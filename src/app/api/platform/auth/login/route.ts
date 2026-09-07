import { NextResponse } from "next/server";
import {
  authenticatePlatformAdministrator,
  PLATFORM_SESSION_COOKIE,
} from "@/server/auth/admin-auth.service";
import { isDomainError } from "@/server/domain/error";
import { jsonError } from "@/server/http/api-response";
import { assertRateLimit, assertRequestRateLimit, getRequestClientKey } from "@/server/http/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  try {
    assertRequestRateLimit(request, { namespace: "platform-login-ip", limit: 15, windowMs: 15 * 60_000 });
    const body = isJson ? await request.json() : await request.formData();
    const email = isJson ? body.email : body.get("email");
    const password = isJson ? body.password : body.get("password");

    assertRateLimit({
      namespace: "platform-login-credential",
      key: `${getRequestClientKey(request)}:${typeof email === "string" ? email.trim().toLowerCase() : "invalid"}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });

    const session = await authenticatePlatformAdministrator({ email, password });
    if (isJson) {
      const response = NextResponse.json({ user: session.user, redirectPath: "/gestao-interna" });
      response.cookies.set({
        name: PLATFORM_SESSION_COOKIE,
        value: session.token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: session.expiresAt,
      });
      return response;
    }

    const response = NextResponse.redirect(new URL("/gestao-interna", request.url), 303);
    response.cookies.set({
      name: PLATFORM_SESSION_COOKIE,
      value: session.token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: session.expiresAt,
    });
    return response;
  } catch (error) {
    if (!isJson) {
      const message = encodeURIComponent(
        isDomainError(error) ? "Credenciais inválidas ou acesso não autorizado." : "Não foi possível acessar agora.",
      );
      return NextResponse.redirect(new URL(`/gestao-interna/login?error=${message}`, request.url), 303);
    }
    return jsonError(error);
  }
}
