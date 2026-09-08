import { NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { setAdminWeddingPublicAccess } from "@/server/admin/admin-weddings.service";
import { assertContentLengthWithinLimit, assertSameOriginRequest, jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ weddingId: string }> },
) {
  try {
    assertSameOriginRequest(request);
    assertContentLengthWithinLimit(request, 16 * 1024);
    const user = await requireAdminSession();
    const { weddingId } = await params;
    const body = (await request.json()) as { revoked?: unknown };

    if (typeof body.revoked !== "boolean") {
      return NextResponse.json(
        { error: { code: "INVALID_PUBLIC_ACCESS_ACTION", message: "Informe se o link deve ser revogado." } },
        { status: 400 },
      );
    }

    const wedding = await setAdminWeddingPublicAccess({
      userId: user.id,
      weddingId,
      revoked: body.revoked,
    });
    return NextResponse.json({ wedding });
  } catch (error) {
    return jsonError(error);
  }
}
