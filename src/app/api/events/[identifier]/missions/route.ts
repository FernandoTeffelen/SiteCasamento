import { listGuestMissions } from "@/server/game/game.service";
import { toPublicGuestIdentity } from "@/server/guests/guest.service";
import { toPublicWeddingResponse } from "@/server/events/wedding.service";
import { getGuestTokenFromRequest, jsonError } from "@/server/http/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const result = await listGuestMissions(identifier, getGuestTokenFromRequest(request));
    return Response.json(
      { wedding: toPublicWeddingResponse(result.wedding), guest: toPublicGuestIdentity(result.guest), missions: result.missions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
