import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, getAdminDashboardAccess, registerAdminUser } from "@/server/auth/admin-auth.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError } from "@/server/http/api-response";
import { isDomainError } from "@/server/domain/error";
import { assertRequestRateLimit } from "@/server/http/rate-limit";
import { getRequestClientIp } from "@/server/http/rate-limit";
import { shouldUseSecureCookies } from "@/server/config/runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    assertRequestRateLimit(request, { namespace: "admin-register", limit: 8, windowMs: 60 * 60_000 });
    let name: unknown;
    let email: unknown;
    let password: unknown;
    let customerType: unknown;
    let acceptedTerms: unknown;
    let acknowledgedPrivacy: unknown;
    let termsVersion: unknown;
    let privacyVersion: unknown;

    if (isJson) {
      const body = await request.json();
      name = body.name;
      email = body.email;
      password = body.password;
      customerType = body.customerType;
      acceptedTerms = body.acceptedTerms;
      acknowledgedPrivacy = body.acknowledgedPrivacy;
      termsVersion = body.termsVersion;
      privacyVersion = body.privacyVersion;
    } else {
      const formData = await request.formData();
      name = formData.get("name");
      email = formData.get("email");
      password = formData.get("password");
      customerType = formData.get("customerType");
      acceptedTerms = formData.get("acceptedTerms") === "on";
      acknowledgedPrivacy = formData.get("acknowledgedPrivacy") === "on";
      termsVersion = formData.get("termsVersion");
      privacyVersion = formData.get("privacyVersion");
    }

    const session = await registerAdminUser({
      name,
      email,
      password,
      customerType,
      acceptedTerms,
      acknowledgedPrivacy,
      termsVersion,
      privacyVersion,
      evidence: {
        ipAddress: getRequestClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });
    const access = await getAdminDashboardAccess(session.user.id);

    const redirectPath = access.canAccessDashboard ? "/app" : "/planos?notice=new_account";

    if (isJson) {
      const response = NextResponse.json({
        user: session.user,
        access,
        isPaying: access.canAccessDashboard,
        redirectPath,
      });
      response.cookies.set({
        name: ADMIN_SESSION_COOKIE,
        value: session.token,
        httpOnly: true,
        sameSite: "lax",
        secure: shouldUseSecureCookies(),
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
      secure: shouldUseSecureCookies(),
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
