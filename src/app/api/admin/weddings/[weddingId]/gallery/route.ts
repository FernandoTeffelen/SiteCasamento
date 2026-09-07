import { NextResponse } from "next/server";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { getAdminWeddingGallery } from "@/server/admin/admin-weddings.service";
import { jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ weddingId: string }> },
) {
  try {
    const user = await requireAdminSession();
    const { weddingId } = await params;
    const searchParams = new URL(request.url).searchParams;
    const page = searchParams.get("page");
    const pageSize = searchParams.get("pageSize");
    const gallery = await getAdminWeddingGallery({
      userId: user.id,
      weddingId,
      page: page === null ? undefined : Number(page),
      pageSize: pageSize === null ? undefined : Number(pageSize),
      guestId: searchParams.get("guestId") ?? undefined,
      missionId: searchParams.get("missionId") ?? undefined,
    });

    return NextResponse.json(gallery, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return jsonError(error);
  }
}
