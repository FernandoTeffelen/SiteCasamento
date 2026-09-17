import { assertContentLengthWithinLimit, jsonError } from "@/server/http/api-response";
import { getRequestClientIp, assertRateLimit, assertRequestRateLimit } from "@/server/http/rate-limit";
import { createMissionPhotoUploadIntent } from "@/server/uploads/photo-upload.service";

export const runtime = "nodejs";

function getBodyObject(body: unknown) {
  return body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

function getFileMetadata(body: Record<string, unknown>) {
  const file = getBodyObject(body.file);
  return { size: file.size, type: file.type, name: file.name };
}

function getOptionalText(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

/** Cria uma autorização temporária para o navegador enviar uma foto privada. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ identifier: string; missionId: string }> },
) {
  try {
    const { identifier, missionId } = await params;
    assertContentLengthWithinLimit(request, 32 * 1024);
    assertRequestRateLimit(request, { namespace: "guest-upload-presign-ip", resource: identifier, limit: 150, windowMs: 60_000 });
    const body = getBodyObject(await request.json());
    const guestToken = body.guestToken;
    assertRateLimit({ namespace: "guest-upload-presign-token", key: `${identifier}:${typeof guestToken === "string" ? guestToken : "missing"}`, limit: 30, windowMs: 60_000 });

    const result = await createMissionPhotoUploadIntent({
      eventIdentifier: identifier,
      guestToken,
      missionId,
      clientUploadId: body.uploadId,
      file: getFileMetadata(body),
      legal: {
        accepted: body.acceptedLegalDocuments === true,
        termsVersion: body.termsVersion,
        privacyVersion: body.privacyVersion,
        clientAcceptedAt: getOptionalText(body.legalAcceptedAt),
        ipAddress: getRequestClientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
