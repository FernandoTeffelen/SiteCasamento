"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import "./style/index.css";

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
      <body className="app-error-body">
        <main className="app-error-card" role="alert">
          <span className="app-error-mark" aria-hidden="true">♡</span>
          <p className="app-error-kicker">SITE CASAMENTO</p>
          <h1>Algo não saiu como esperado</h1>
          <p>O erro foi registrado. Tente carregar a página novamente.</p>
          <button className="app-error-button" type="button" onClick={() => reset()}>
            Tentar novamente
          </button>
        </main>
      </body>
    </html>
  );
}
