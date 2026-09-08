import * as Sentry from "@sentry/nextjs";
import { createSentryOptions } from "@/lib/observability/sentry";

const sentryGlobal = globalThis as typeof globalThis & { __siteCasamentoSentryClientInitialized?: boolean };

if (!sentryGlobal.__siteCasamentoSentryClientInitialized) {
  Sentry.init(
    createSentryOptions({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
      tracesSampleRate: process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    }),
  );
  sentryGlobal.__siteCasamentoSentryClientInitialized = true;
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
