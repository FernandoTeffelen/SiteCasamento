import { registerOrIdentifyGuest } from "@/server/guests/guest.service";
import { jsonError, readJsonBody } from "@/server/http/api-response";

export async function POST(request: Request, { params }: { params: Promise<{ identifier: string }> }) {
  try {
    const [{ identifier }, body] = await Promise.all([params, readJsonBody(request)]);
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
