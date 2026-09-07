import { DomainError, isDomainError } from "@/server/domain/error";

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

/** Rejeita cedo corpos declaradamente grandes antes de carregá-los em memória. */
export function assertContentLengthWithinLimit(request: Request, maxBytes: number) {
  const rawValue = request.headers.get("content-length");
  if (!rawValue) return;
  const contentLength = Number(rawValue);
  if (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > maxBytes) {
    throw new DomainError("REQUEST_BODY_TOO_LARGE", 413, "O arquivo excede o tamanho máximo permitido.");
  }
}

/** Cookies administrativos usam SameSite=Lax; Origin acrescenta defesa contra CSRF no navegador. */
export function assertSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    throw new DomainError("CROSS_ORIGIN_REQUEST", 403, "A solicitação foi bloqueada por segurança.");
  }
}

export function getGuestTokenFromRequest(request: Request) {
  return new URL(request.url).searchParams.get("guestToken");
}
