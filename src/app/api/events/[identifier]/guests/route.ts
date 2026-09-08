import { registerOrIdentifyGuest, toPublicGuestIdentity } from "@/server/guests/guest.service";
import { toPublicWeddingResponse } from "@/server/events/wedding.service";
import { assertContentLengthWithinLimit, jsonError, readJsonBody } from "@/server/http/api-response";
import { assertRequestRateLimit } from "@/server/http/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    assertContentLengthWithinLimit(request, 16 * 1024);
    // A margem comporta convidados na mesma rede do evento, mas contém abuso.
    assertRequestRateLimit(request, { namespace: "guest-registration", resource: identifier, limit: 120, windowMs: 60_000 });
    const body = await readJsonBody(request);
    const result = await registerOrIdentifyGuest(identifier, {
      name: body.name,
      email: body.email,
      guestToken: body.guestToken,
    });

    return Response.json(
      { wedding: toPublicWeddingResponse(result.wedding), guest: toPublicGuestIdentity(result.guest), created: result.created },
      { status: result.created ? 201 : 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return jsonError(error);
  }
}
