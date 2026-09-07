import { NextResponse } from "next/server";
import { PLATFORM_SESSION_COOKIE, revokeAdminSession } from "@/server/auth/admin-auth.service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PLATFORM_SESSION_COOKIE}=`))
    ?.slice(PLATFORM_SESSION_COOKIE.length + 1);

  // Encerrar a sessão local é seguro mesmo se o banco estiver temporariamente indisponível.
  await revokeAdminSession(token).catch(() => undefined);
  const response = NextResponse.redirect(new URL("/gestao-interna/login", request.url), 303);
  response.cookies.set({
    name: PLATFORM_SESSION_COOKIE,
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
