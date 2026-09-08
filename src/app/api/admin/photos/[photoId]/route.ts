import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { getAdminPhotoStream } from "@/server/admin/admin-weddings.service";
import { jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ photoId: string }> },
) {
  try {
    const user = await requireAdminSession();
    const { photoId } = await params;
    const { body, contentType } = await getAdminPhotoStream({ userId: user.id, photoId });

    return new Response(Buffer.from(body), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
