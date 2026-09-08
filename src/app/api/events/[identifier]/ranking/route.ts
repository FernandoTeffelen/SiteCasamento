import { getEventRanking } from "@/server/game/game.service";
import { toPublicWeddingResponse } from "@/server/events/wedding.service";
import { jsonError } from "@/server/http/api-response";

export async function GET(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const limit = new URL(request.url).searchParams.get("limit");
    const result = await getEventRanking(identifier, limit);
    return Response.json(
      { wedding: toPublicWeddingResponse(result.wedding), ranking: result.ranking.map(({ name, score, position }) => ({ name, score, position })) },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
