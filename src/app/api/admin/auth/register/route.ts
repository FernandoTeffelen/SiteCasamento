import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, checkUserIsPayingOrActive, registerAdminUser } from "@/server/auth/admin-auth.service";
import { jsonError } from "@/server/http/api-response";
import { isDomainError } from "@/server/domain/error";
import { assertRequestRateLimit } from "@/server/http/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  try {
    assertRequestRateLimit(request, { namespace: "admin-register", limit: 8, windowMs: 60 * 60_000 });
    let name: unknown;
    let email: unknown;
    let password: unknown;
    let customerType: unknown;

    if (isJson) {
      const body = await request.json();
      name = body.name;
      email = body.email;
      password = body.password;
      customerType = body.customerType;
    } else {
      const formData = await request.formData();
      name = formData.get("name");
      email = formData.get("email");
      password = formData.get("password");
      customerType = formData.get("customerType");
    }

    const session = await registerAdminUser({ name, email, password, customerType });
    const isPaying = await checkUserIsPayingOrActive(session.user.id);

    const redirectPath = isPaying ? "/app" : "/planos?notice=new_account";

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
    if (!isJson && isDomainError(error)) {
      const errorMsg = encodeURIComponent(error.message);
      return NextResponse.redirect(new URL(`/app/cadastro?error=${errorMsg}`, request.url), 303);
    }
    return jsonError(error);
  }
}
