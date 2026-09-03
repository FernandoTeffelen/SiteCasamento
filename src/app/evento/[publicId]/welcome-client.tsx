"use client";

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { EventView } from "@/features/event/types";
import { getLocalGuestEmail, getLocalGuestName, getLocalGuestToken, saveLocalGuest } from "@/lib/guest/local-guest";
import { visualConfigToCssVariables } from "@/lib/templates/wedding-visual-config";

type JoinEventResponse = {
  guest?: { name: string; email: string | null; token: string };
  error?: { message?: string };
};

export function WelcomeClient({ event }: { event: EventView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      setGuestName(getLocalGuestName(event.publicId));
      setGuestEmail(getLocalGuestEmail(event.publicId));
    }, 0);

    return () => window.clearTimeout(timerId);
  }, [event.publicId]);

  async function enterGame(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const normalizedName = guestName.trim();
    const normalizedEmail = guestEmail.trim();

    if (!normalizedName) {
      setError("Digite seu nome ou apelido para entrar.");
      inputRef.current?.focus();
      return;
    }
    if (!normalizedEmail) {
      setError("Informe seu e-mail para diferenciar seu perfil.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.identifier)}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          guestToken: getLocalGuestToken(event.publicId) || undefined,
        }),
      });
      const payload = await response.json() as JoinEventResponse;

      if (!response.ok || !payload.guest?.token) {
        throw new Error(payload.error?.message ?? "Não foi possível entrar no jogo.");
      }

      saveLocalGuest(event.publicId, payload.guest);
      router.push(`${event.publicPath}/jogo`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível entrar no jogo.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="welcome-screen wedding-themed" style={visualConfigToCssVariables(event.visual) as CSSProperties}>
      <div className="welcome-glow welcome-glow-top" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-bottom" aria-hidden="true" />

      <section className="welcome-content" aria-labelledby="couple-name">
        <header className="welcome-header">
          {event.visual.assets.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="welcome-cover" src={event.visual.assets.coverImageUrl} alt="Capa do casamento" />
          ) : null}
          {event.visual.assets.logoImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="welcome-logo" src={event.visual.assets.logoImageUrl} alt={`Logo de ${event.name}`} />
          ) : <div className="monogram" aria-hidden="true"><span>♥</span></div>}
          <p className="event-kicker">{event.visual.texts.eventKicker}</p>
          <h1 id="couple-name">{event.brideName} <span>&amp;</span> {event.groomName}</h1>
        </header>

        <div className="welcome-copy">
          <p className="welcome-title">{event.visual.texts.welcomeTitle}</p>
          <p className="welcome-description">{event.visual.texts.welcomeDescription}</p>
        </div>

        <form className="entry-form" onSubmit={enterGame} noValidate>
          <label htmlFor="guest-name">Como podemos te chamar?</label>
          <input
            ref={inputRef}
            id="guest-name"
            name="guest-name"
            type="text"
            placeholder="Seu nome ou apelido"
            value={guestName}
            maxLength={40}
            disabled={isSubmitting}
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="go"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "guest-name-error" : undefined}
            onChange={(inputEvent) => {
              setGuestName(inputEvent.target.value);
              if (error) setError(null);
            }}
          />
          <label htmlFor="guest-email">Seu e-mail</label>
          <input
            id="guest-email"
            name="guest-email"
            type="email"
            placeholder="voce@exemplo.com"
            value={guestEmail}
            maxLength={254}
            disabled={isSubmitting}
            autoComplete="email"
            inputMode="email"
            enterKeyHint="go"
            onChange={(inputEvent) => {
              setGuestEmail(inputEvent.target.value);
              if (error) setError(null);
            }}
          />
          {error ? <p className="entry-error" id="guest-name-error" role="alert">{error}</p> : null}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Entrando…" : <>Entrar no jogo <span aria-hidden="true">→</span></>}
          </button>
        </form>
      </section>

      <p className="welcome-footer">Leva só alguns segundos. Seu e-mail só diferencia seu perfil; não há senha.</p>
    </main>
  );
}
