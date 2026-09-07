import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, authenticateAdmin, checkUserIsPayingOrActive } from "@/server/auth/admin-auth.service";
import { jsonError } from "@/server/http/api-response";
import { isDomainError } from "@/server/domain/error";
import { assertRateLimit, assertRequestRateLimit, getRequestClientKey } from "@/server/http/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  try {
    assertRequestRateLimit(request, { namespace: "admin-login-ip", limit: 30, windowMs: 15 * 60_000 });
    let email: unknown;
    let password: unknown;

    if (isJson) {
      const body = await request.json();
      email = body.email;
      password = body.password;
    } else {
      const formData = await request.formData();
      email = formData.get("email");
      password = formData.get("password");
    }

    assertRateLimit({
      namespace: "admin-login-credential",
      key: `${getRequestClientKey(request)}:${typeof email === "string" ? email.trim().toLowerCase() : "invalid"}`,
      limit: 5,
      windowMs: 15 * 60_000,
    });

    const session = await authenticateAdmin({ email, password });
    const isPaying = await checkUserIsPayingOrActive(session.user.id);
    const redirectPath = isPaying ? "/app" : "/planos?notice=subscription_required";

    if (isJson) {
      const response = NextResponse.json({ user: session.user, isPaying, redirectPath });
      response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: session.token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: session.expiresAt,
      });
      return response;
    }

    const response = NextResponse.redirect(new URL(redirectPath, request.url), 303);
    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
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
      const errorMsg = encodeURIComponent(
        isDomainError(error)
          ? "E-mail ou senha incorretos."
          : "Não foi possível acessar agora. Verifique se o banco de dados está disponível.",
      );
      return NextResponse.redirect(new URL(`/app/login?error=${errorMsg}`, request.url), 303);
    }
    return jsonError(error);
  }
}
