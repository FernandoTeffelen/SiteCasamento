import { NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { deleteAdminWedding } from "@/server/admin/admin-weddings.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError, readJsonBody } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ weddingId: string }> },
) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    const user = await requireAdminSession();
    const { weddingId } = await params;
    const body = await readJsonBody(request);
    const result = await deleteAdminWedding({ userId: user.id, weddingId, password: body.password });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
