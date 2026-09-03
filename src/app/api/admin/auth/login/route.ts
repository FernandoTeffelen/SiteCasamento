import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, authenticateAdmin } from "@/server/auth/admin-auth.service";
import { jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const session = await authenticateAdmin({ email: formData.get("email"), password: formData.get("password") });
    const response = NextResponse.redirect(new URL("/app", request.url), 303);
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
    return jsonError(error);
  }
}
