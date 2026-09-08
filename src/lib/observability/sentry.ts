import type { Event } from "@sentry/nextjs";

const SENSITIVE_KEYS = /password|passwd|secret|token|authorization|cookie|set-cookie|api[-_]?key|access[-_]?key|private[-_]?key|dsn|session|credential|file|image|buffer|body|content/i;
const SENSITIVE_PATH_SEGMENTS = /\/(?:w|evento|events|weddings|customers|photos|missions|submissions)\/[^/?#]+/gi;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const BEARER_PATTERN = /\bBearer\s+[^\s,]+/gi;

function scrubString(value: string): string {
  return value
    .replace(BEARER_PATTERN, "Bearer [redacted]")
    .replace(SENSITIVE_PATH_SEGMENTS, (match) => match.slice(0, match.lastIndexOf("/") + 1) + "[redacted]")
    .replace(/([?&](?:token|id|publicId|identifier|session)=[^&#\s]*)/gi, "$1".replace(/=.*/, "=[redacted]"))
    .replace(EMAIL_PATTERN, "[email]");
}

function scrubUnknown(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[redacted]";
  if (typeof value === "string") return scrubString(value);
  if (typeof value === "number" || typeof value === "boolean" || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => scrubUnknown(item, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.test(key) ? "[redacted]" : scrubUnknown(entry, depth + 1),
      ]),
    );
  }
  return "[redacted]";
}

function scrubUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  const withoutQuery = url.split(/[?#]/, 1)[0];
  return scrubString(withoutQuery);
}

/**
 * Sentry must never receive credentials, wedding access tokens or photo data.
 * Keep this filter shared by browser, Node.js and Edge SDK instances.
 */
export function scrubSentryEvent<T extends Event>(event: T): T {
  event.user = undefined;
  event.request = event.request
    ? {
        ...event.request,
        url: scrubUrl(event.request.url),
        query_string: undefined,
        cookies: undefined,
        headers: undefined,
        data: undefined,
      }
    : undefined;
  event.message = event.message ? scrubString(event.message) : event.message;
  event.transaction = event.transaction ? scrubString(event.transaction) : event.transaction;
  event.tags = event.tags ? (scrubUnknown(event.tags) as Record<string, string>) : event.tags;
  event.extra = event.extra ? (scrubUnknown(event.extra) as Record<string, unknown>) : event.extra;
  event.contexts = event.contexts ? scrubUnknown(event.contexts) as typeof event.contexts : event.contexts;
  event.breadcrumbs = event.breadcrumbs?.map((breadcrumb) => ({
    ...breadcrumb,
    message: breadcrumb.message ? scrubString(breadcrumb.message) : breadcrumb.message,
    data: breadcrumb.data ? (scrubUnknown(breadcrumb.data) as Record<string, unknown>) : breadcrumb.data,
  }));
  if (event.exception?.values) {
    event.exception.values = event.exception.values.map((exception) => ({
      ...exception,
      value: exception.value ? scrubString(exception.value) : exception.value,
    }));
  }
  return event;
}

export function parseSentrySampleRate(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : fallback;
}

export function createSentryOptions({
  dsn,
  environment,
  tracesSampleRate,
}: {
  dsn?: string;
  environment?: string;
  tracesSampleRate?: string;
}) {
  const normalizedDsn = dsn?.trim() || undefined;
  const isProduction = process.env.NODE_ENV === "production";

  return {
    dsn: normalizedDsn,
    enabled: Boolean(normalizedDsn),
    environment: environment?.trim() || process.env.NODE_ENV || "development",
    sendDefaultPii: false,
    tracesSampleRate: parseSentrySampleRate(tracesSampleRate, isProduction ? 0.1 : 0),
    beforeSend: scrubSentryEvent,
    beforeSendTransaction: scrubSentryEvent,
  };
}
