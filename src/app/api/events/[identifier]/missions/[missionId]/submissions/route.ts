import { DomainError } from "@/server/domain/error";
import { assertContentLengthWithinLimit, jsonError } from "@/server/http/api-response";
import { assertRateLimit, assertRequestRateLimit } from "@/server/http/rate-limit";
import {
  deleteLegacyGuestSubmission,
  getMaximumUploadBytes,
  uploadMissionPhoto,
  type UploadPhotoFile,
} from "@/server/uploads/photo-upload.service";
import { getGuestTokenFromRequest } from "@/server/http/api-response";

export const runtime = "nodejs";

function getTextValue(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function isUploadPhotoFile(value: FormDataEntryValue | null): value is File & UploadPhotoFile {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<UploadPhotoFile>;
  return typeof candidate.arrayBuffer === "function"
    && typeof candidate.type === "string"
    && typeof candidate.size === "number";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ identifier: string; missionId: string }> },
) {
  try {
    const { identifier, missionId } = await params;
    assertContentLengthWithinLimit(request, getMaximumUploadBytes() + 1_048_576);
    assertRequestRateLimit(request, { namespace: "guest-upload-ip", resource: identifier, limit: 150, windowMs: 60_000 });
    const formData = await request.formData();
    const photo = formData.get("photo");
    if (!isUploadPhotoFile(photo)) {
      throw new DomainError("PHOTO_REQUIRED", 400, "Escolha uma foto para enviar.");
    }
    const guestToken = getTextValue(formData, "guestToken");
    assertRateLimit({ namespace: "guest-upload-token", key: `${identifier}:${guestToken ?? "missing"}`, limit: 15, windowMs: 60_000 });

    const result = await uploadMissionPhoto({
      eventIdentifier: identifier,
      guestToken,
      missionId,
      clientUploadId: getTextValue(formData, "uploadId"),
      file: photo,
    });
    return Response.json(result, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ identifier: string; missionId: string }> },
) {
  try {
    const { identifier, missionId } = await params;
    assertRequestRateLimit(request, { namespace: "guest-submission-delete", resource: identifier, limit: 30, windowMs: 60_000 });
    const uploadId = new URL(request.url).searchParams.get("uploadId");
    const result = await deleteLegacyGuestSubmission({
      eventIdentifier: identifier,
      guestToken: getGuestTokenFromRequest(request),
      missionId,
      clientUploadId: uploadId,
    });
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return jsonError(error);
  }
}
