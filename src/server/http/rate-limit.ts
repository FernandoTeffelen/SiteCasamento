import { DomainError } from "@/server/domain/error";

type RateLimitInput = {
  namespace: string;
  key: string;
  limit: number;
  windowMs: number;
  now?: number;
};

type RateLimitEntry = { count: number; resetAt: number };

const entries = new Map<string, RateLimitEntry>();
const MAX_TRACKED_KEYS = 10_000;

function normalizedKey(value: string) {
  return value.trim().slice(0, 256) || "unknown";
}

function discardExpiredEntries(now: number) {
  for (const [key, entry] of entries) if (entry.resetAt <= now) entries.delete(key);
}

/**
 * Limite simples por processo para rotas expostas. Ele protege a aplicação
 * hoje sem introduzir uma dependência distribuída; em múltiplas instâncias, o
 * proxy/WAF deve aplicar o limite global equivalente.
 */
export function assertRateLimit(input: RateLimitInput) {
  const now = input.now ?? Date.now();
  const limit = Math.floor(input.limit);
  const windowMs = Math.floor(input.windowMs);
  if (limit < 1 || windowMs < 1) throw new Error("Invalid rate limit configuration");

  const key = `${input.namespace}:${normalizedKey(input.key)}`;
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    if (entries.size >= MAX_TRACKED_KEYS) {
      discardExpiredEntries(now);
      const oldestKey = entries.keys().next().value;
      if (entries.size >= MAX_TRACKED_KEYS && oldestKey) entries.delete(oldestKey);
    }
    entries.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new DomainError("RATE_LIMITED", 429, "Muitas tentativas. Aguarde um instante e tente novamente.");
  }
  current.count += 1;
}

/** O proxy de produção deve sobrescrever x-forwarded-for antes de encaminhar a requisição. */
export function getRequestClientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return normalizedKey(forwarded || request.headers.get("x-real-ip") || "unknown");
}

export function assertRequestRateLimit(
  request: Request,
  input: Omit<RateLimitInput, "key" | "now"> & { resource?: string },
) {
  assertRateLimit({ ...input, key: `${getRequestClientKey(request)}:${input.resource ?? "global"}` });
}

export function resetRateLimitForTests() {
  entries.clear();
}
