import { deleteGuestSubmission } from "@/server/uploads/photo-upload.service";
import { getGuestTokenFromRequest, jsonError } from "@/server/http/api-response";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ identifier: string; missionId: string; submissionId: string }> },
) {
  try {
    const { identifier, missionId, submissionId } = await params;
    const result = await deleteGuestSubmission({
      eventIdentifier: identifier,
      guestToken: getGuestTokenFromRequest(request),
      missionId,
      submissionId,
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
