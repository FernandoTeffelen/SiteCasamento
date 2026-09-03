import { NextResponse } from "next/server";
import { requireAdminSession, updateAdminProfile } from "@/server/auth/admin-auth.service";
import { jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  try {
    const user = await requireAdminSession();
    const body = await request.json();
    const updated = await updateAdminProfile({
      userId: user.id,
      name: body.name,
      email: body.email,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    return NextResponse.json({ user: updated });
  } catch (error) {
    return jsonError(error);
  }
}
