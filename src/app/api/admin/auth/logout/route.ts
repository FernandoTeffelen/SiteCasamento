import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, revokeAdminSession } from "@/server/auth/admin-auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_SESSION_COOKIE}=`))
    ?.slice(ADMIN_SESSION_COOKIE.length + 1);

  await revokeAdminSession(token).catch(() => undefined);
  const response = NextResponse.redirect(new URL("/app/login", request.url), 303);
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
  return response;
}
