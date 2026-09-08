"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body>
        <main style={{ margin: "4rem auto", maxWidth: 520, padding: "0 1.25rem", fontFamily: "system-ui, sans-serif" }}>
          <h1>Algo não saiu como esperado</h1>
          <p>O erro foi registrado. Tente carregar a página novamente.</p>
          <button type="button" onClick={() => reset()}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
