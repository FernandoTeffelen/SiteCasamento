import { listGuestMissions } from "@/server/game/game.service";
import { getGuestTokenFromRequest, jsonError } from "@/server/http/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const result = await listGuestMissions(identifier, getGuestTokenFromRequest(request));
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
