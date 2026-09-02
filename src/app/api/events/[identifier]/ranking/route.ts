import { getEventRanking } from "@/server/game/game.service";
import { jsonError } from "@/server/http/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const limit = new URL(request.url).searchParams.get("limit");
    const result = await getEventRanking(identifier, limit);
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
