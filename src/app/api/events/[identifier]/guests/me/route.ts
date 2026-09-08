import { getGuestScore } from "@/server/game/game.service";
import { toPublicGuestIdentity, updateGuestProfile } from "@/server/guests/guest.service";
import { toPublicWeddingResponse } from "@/server/events/wedding.service";
import { assertContentLengthWithinLimit, getGuestTokenFromRequest, jsonError } from "@/server/http/api-response";
import { assertRateLimit } from "@/server/http/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const result = await getGuestScore(identifier, getGuestTokenFromRequest(request));
    return Response.json(
      { wedding: toPublicWeddingResponse(result.wedding), guest: toPublicGuestIdentity(result.guest) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    assertContentLengthWithinLimit(request, 6 * 1024 * 1024);
    const formData = await request.formData();
    const guestToken = formData.get("guestToken");
    assertRateLimit({ namespace: "guest-profile-update", key: `${identifier}:${typeof guestToken === "string" ? guestToken : "missing"}`, limit: 20, windowMs: 60_000 });
    const rawAvatar = formData.get("avatar");
    if (rawAvatar !== null && typeof rawAvatar === "string") {
      return Response.json(
        { error: { code: "INVALID_AVATAR", message: "A foto de perfil é inválida." } },
        { status: 400 },
      );
    }
    const result = await updateGuestProfile({
      eventIdentifier: identifier,
      guestToken,
      name: formData.get("name"),
      email: formData.get("email"),
      age: formData.get("age"),
      relationshipToCouple: formData.get("relationshipToCouple"),
      avatar: rawAvatar instanceof File ? rawAvatar : null,
      clearAvatar: formData.get("clearAvatar"),
    });
    return Response.json(
      { wedding: toPublicWeddingResponse(result.wedding), guest: toPublicGuestIdentity(result.guest) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
