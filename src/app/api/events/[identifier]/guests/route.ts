import { registerOrIdentifyGuest } from "@/server/guests/guest.service";
import { jsonError, readJsonBody } from "@/server/http/api-response";
import { assertRequestRateLimit } from "@/server/http/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const { identifier } = await params;
    // A margem comporta convidados na mesma rede do evento, mas contém abuso.
    assertRequestRateLimit(request, { namespace: "guest-registration", resource: identifier, limit: 120, windowMs: 60_000 });
    const body = await readJsonBody(request);
    const result = await registerOrIdentifyGuest(identifier, {
      name: body.name,
      email: body.email,
      guestToken: body.guestToken,
    });

    return Response.json(result, { status: result.created ? 201 : 200 });
  } catch (error) {
    return jsonError(error);
  }
}
