import { assertWeddingIsActive, findWeddingByPublicAccessToken } from "@/server/events/wedding.service";
import { jsonError } from "@/server/http/api-response";

export async function GET(_: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    const wedding = await findWeddingByPublicAccessToken(identifier);
    assertWeddingIsActive(wedding);
    return Response.json({ wedding });
  } catch (error) {
    return jsonError(error);
  }
}
