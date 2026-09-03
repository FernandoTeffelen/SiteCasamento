import { NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { deleteAdminWedding } from "@/server/admin/admin-weddings.service";
import { jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ weddingId: string }> },
) {
  try {
    const user = await requireAdminSession();
    const { weddingId } = await params;
    const result = await deleteAdminWedding({ userId: user.id, weddingId });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
