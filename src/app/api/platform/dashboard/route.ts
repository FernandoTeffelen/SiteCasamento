import { NextResponse } from "next/server";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { jsonError } from "@/server/http/api-response";
import { getPlatformDashboardData } from "@/server/platform/platform-dashboard.service";

export const runtime = "nodejs";

/** Endpoint interno: a autorização é repetida no serviço antes de consultar os dados. */
export async function GET() {
  try {
    const user = await requirePlatformAdministrator();
    return NextResponse.json(await getPlatformDashboardData(user.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
