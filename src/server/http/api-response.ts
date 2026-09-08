import { assertAllowedRequestOrigin } from "@/server/config/runtime";
import { DomainError, isDomainError } from "@/server/domain/error";

export function jsonError(error: unknown) {
  if (isDomainError(error)) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }

  // Erros completos podem conter detalhes do banco, caminhos locais ou segredos.
  // Eles ficam disponíveis apenas no log de desenvolvimento.
  if (process.env.NODE_ENV === "production") {
    console.error("Unexpected API error");
  } else {
    console.error("Unexpected API error", error);
  }
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

/** Rejeita cedo corpos declaradamente grandes antes de carregá-los em memória. */
export function assertContentLengthWithinLimit(request: Request, maxBytes: number) {
  const rawValue = request.headers.get("content-length");
  if (!rawValue) return;
  const contentLength = Number(rawValue);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes) {
    throw new DomainError("REQUEST_BODY_TOO_LARGE", 413, "O arquivo excede o tamanho máximo permitido.");
  }
}

/** Rejeita origens não autorizadas em operações administrativas mutáveis. */
export function assertSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    assertAllowedRequestOrigin(request, { required: true });
    return;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      assertAllowedRequestOrigin(request, { required: true, originOverride: new URL(referer).origin });
      return;
    } catch (error) {
      if (error instanceof DomainError) throw error;
    }
  }

  throw new DomainError("CROSS_ORIGIN_REQUEST", 403, "A solicitaÃ§Ã£o foi bloqueada por seguranÃ§a.");
}

export function getGuestTokenFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("guestToken");
}
