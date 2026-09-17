import { assertContentLengthWithinLimit, jsonError } from "@/server/http/api-response";
import { assertRateLimit, assertRequestRateLimit } from "@/server/http/rate-limit";
import { finalizeMissionPhotoDirectUpload } from "@/server/uploads/photo-upload.service";

export const runtime = "nodejs";

function getBodyObject(body: unknown) {
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

/** Valida o objeto privado no storage e só então registra a foto e a pontuação. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ identifier: string; missionId: string }> },
) {
  try {
    const { identifier, missionId } = await params;
    assertContentLengthWithinLimit(request, 16 * 1024);
    assertRequestRateLimit(request, { namespace: "guest-upload-finalize-ip", resource: identifier, limit: 150, windowMs: 60_000 });
    const body = getBodyObject(await request.json());
    const guestToken = body.guestToken;
    assertRateLimit({ namespace: "guest-upload-finalize-token", key: `${identifier}:${typeof guestToken === "string" ? guestToken : "missing"}`, limit: 30, windowMs: 60_000 });

    const result = await finalizeMissionPhotoDirectUpload({
      eventIdentifier: identifier,
      guestToken,
      missionId,
      clientUploadId: body.uploadId,
      originalName: body.originalName,
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
