import { registerMissionCompletion } from "@/server/game/game.service";
import { jsonError, readJsonBody } from "@/server/http/api-response";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ identifier: string; missionId: string }> },
) {
  try {
    const [{ identifier, missionId }, body] = await Promise.all([params, readJsonBody(request)]);
    const result = await registerMissionCompletion(identifier, body.guestToken, missionId);
    return Response.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
