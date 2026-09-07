import { NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { createAdminWedding, getAdminDashboardData } from "@/server/admin/admin-weddings.service";
import { assertSameOriginRequest, jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireAdminSession();
    const data = await getAdminDashboardData(user.id);
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOriginRequest(request);
    const user = await requireAdminSession();
    const body = await request.json();
    const wedding = await createAdminWedding({
      userId: user.id,
      name: body.name,
      brideName: body.brideName,
      groomName: body.groomName,
      eventDate: body.eventDate,
    });
    return NextResponse.json({ wedding }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
