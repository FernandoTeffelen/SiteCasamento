import { isDomainError } from "@/server/domain/error";

export function jsonError(error: unknown) {
  if (isDomainError(error)) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  console.error("Unexpected API error", error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Não foi possível concluir a solicitação." } },
    { status: 500 },
  );
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new Error("Invalid JSON body");
    }

    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function getGuestTokenFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("guestToken");
}
