import * as Sentry from "@sentry/nextjs";
import { createSentryOptions } from "@/lib/observability/sentry";

const sentryGlobal = globalThis as typeof globalThis & { __siteCasamentoSentryServerInitialized?: boolean };

if (!sentryGlobal.__siteCasamentoSentryServerInitialized) {
  Sentry.init(
    createSentryOptions({
      dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.SENTRY_ENVIRONMENT,
      tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE,
    }),
  );
  sentryGlobal.__siteCasamentoSentryServerInitialized = true;
}
