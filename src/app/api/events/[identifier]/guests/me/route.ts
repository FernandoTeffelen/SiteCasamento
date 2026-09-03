import { getGuestScore } from "@/server/game/game.service";
import { updateGuestProfile } from "@/server/guests/guest.service";
import { getGuestTokenFromRequest, jsonError } from "@/server/http/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const result = await getGuestScore(identifier, getGuestTokenFromRequest(request));
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const [{ identifier }, formData] = await Promise.all([params, request.formData()]);
    const rawAvatar = formData.get("avatar");
    if (rawAvatar !== null && typeof rawAvatar === "string") {
      return Response.json(
        { error: { code: "INVALID_AVATAR", message: "A foto de perfil é inválida." } },
        { status: 400 },
      );
    }
    const result = await updateGuestProfile({
      eventIdentifier: identifier,
      guestToken: formData.get("guestToken"),
      name: formData.get("name"),
      email: formData.get("email"),
      age: formData.get("age"),
      relationshipToCouple: formData.get("relationshipToCouple"),
      avatar: rawAvatar instanceof File ? rawAvatar : null,
      clearAvatar: formData.get("clearAvatar"),
    });
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
