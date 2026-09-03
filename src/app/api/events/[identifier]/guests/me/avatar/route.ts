import { getGuestAvatar } from "@/server/guests/guest.service";
import { getGuestTokenFromRequest, jsonError } from "@/server/http/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const avatar = await getGuestAvatar({
      eventIdentifier: identifier,
      guestToken: getGuestTokenFromRequest(request),
    });
    return new Response(avatar.body.slice().buffer as ArrayBuffer, {
      headers: {
        "Content-Type": avatar.contentType,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
