"use client";

import { FormEvent, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { EventView } from "@/features/event/types";
import {
  clearActiveLocalGuest,
  getLocalGuestEmail,
  getLocalGuestToken,
  getSavedLocalGuests,
  saveLocalGuest,
  type LocalGuestAccount,
} from "@/lib/guest/local-guest";
import { visualConfigToCssVariables } from "@/lib/templates/wedding-visual-config";
import Link from "next/link";
import { currentLegalVersions } from "@/lib/legal/legal-versions";

type JoinEventResponse = { guest?: { name: string; email: string | null; token: string }; error?: { message?: string } };

export function WelcomeClient({ event }: { event: EventView }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [savedGuests, setSavedGuests] = useState<LocalGuestAccount[]>([]);
  const [showEntryForm, setShowEntryForm] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<"name" | "email" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acknowledgedPrivacy, setAcknowledgedPrivacy] = useState(false);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      const accounts = getSavedLocalGuests(event.publicId);
      setSavedGuests(accounts);
      setShowEntryForm(accounts.length === 0);
    }, 0);
    return () => window.clearTimeout(timerId);
  }, [event.publicId]);

  function continueAs(guest: LocalGuestAccount) {
    saveLocalGuest(event.publicId, guest);
    router.push(`${event.publicPath}/jogo`);
  }

  function showNewGuestForm() {
    clearActiveLocalGuest(event.publicId);
    setGuestName("");
    setGuestEmail("");
    setError(null);
    setShowEntryForm(true);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function enterGame(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const normalizedName = guestName.trim();
    const normalizedEmail = guestEmail.trim();
    if (!normalizedName) { setErrorField("name"); setError("Digite seu nome ou apelido para entrar."); inputRef.current?.focus(); return; }
    if (!normalizedEmail || emailRef.current?.validity.typeMismatch) {
      setErrorField("email");
      setError(normalizedEmail ? "Confira o e-mail. Use o formato nome@exemplo.com." : "Informe seu e-mail para identificar seu perfil.");
      emailRef.current?.focus();
      return;
    }
    if (!acceptedTerms || !acknowledgedPrivacy) {
      setErrorField(null);
      setError("Confirme os Termos de Uso e a leitura da Política de Privacidade.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setErrorField(null);
    try {
      const activeEmail = getLocalGuestEmail(event.publicId).toLocaleLowerCase("en-US");
      const guestToken = activeEmail === normalizedEmail.toLocaleLowerCase("en-US") ? getLocalGuestToken(event.publicId) : "";
      const response = await fetch(`/api/events/${encodeURIComponent(event.identifier)}/guests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: normalizedName,
          email: normalizedEmail,
          guestToken: guestToken || undefined,
          acceptedTerms,
          acknowledgedPrivacy,
          termsVersion: currentLegalVersions.termsOfUse,
          privacyVersion: currentLegalVersions.privacyPolicy,
          clientAcceptedAt: new Date().toISOString(),
        }),
      });
      const payload = await response.json() as JoinEventResponse;
      if (!response.ok || !payload.guest?.token) throw new Error(payload.error?.message ?? "Não foi possível entrar no jogo.");
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
        <div className="welcome-copy"><p className="welcome-title">{event.visual.texts.welcomeTitle}</p><p className="welcome-description">{event.visual.texts.welcomeDescription}</p></div>
        <ol className="guest-entry-steps" aria-label="Como participar">
          <li><span>1</span> Entre no jogo</li>
          <li><span>2</span> Escolha uma missão</li>
          <li><span>3</span> Registre o momento</li>
        </ol>

        {!showEntryForm && savedGuests.length ? (
          <section className="guest-switcher" aria-labelledby="guest-switcher-title">
            <div><p className="section-kicker">Neste aparelho</p><h2 id="guest-switcher-title">Quem vai participar?</h2><span>Escolha um perfil já usado neste casamento ou entre com outra pessoa.</span></div>
            <div className="guest-switcher-list">{savedGuests.map((guest) => <button type="button" key={guest.token} onClick={() => continueAs(guest)}><span className="guest-switcher-initial">{Array.from(guest.name)[0]?.toLocaleUpperCase("pt-BR") ?? "C"}</span><span><strong>{guest.name}</strong><small>{guest.email ?? "Perfil do convidado"}</small></span><b aria-hidden="true">→</b></button>)}</div>
            <button type="button" className="guest-switcher-new" onClick={showNewGuestForm}>Entrar com outra pessoa</button>
          </section>
        ) : (
          <form className="entry-form" onSubmit={enterGame} noValidate aria-busy={isSubmitting}>
            <label htmlFor="guest-name">Como podemos te chamar?</label>
            <input ref={inputRef} id="guest-name" name="guest-name" type="text" placeholder="Seu nome ou apelido" value={guestName} maxLength={40} disabled={isSubmitting} required autoComplete="name" autoCapitalize="words" enterKeyHint="next" aria-invalid={Boolean(error) && errorField === "name"} aria-describedby={error && errorField === "name" ? "guest-entry-error" : undefined} onChange={(inputEvent) => { setGuestName(inputEvent.target.value); if (error) setError(null); }} />
            <label htmlFor="guest-email">Seu e-mail</label>
            <input ref={emailRef} id="guest-email" name="guest-email" type="email" placeholder="voce@exemplo.com" value={guestEmail} maxLength={254} disabled={isSubmitting} required autoComplete="email" autoCapitalize="none" spellCheck={false} inputMode="email" enterKeyHint="go" aria-invalid={Boolean(error) && errorField === "email"} aria-describedby={error && errorField === "email" ? "guest-email-hint guest-entry-error" : "guest-email-hint"} onChange={(inputEvent) => { setGuestEmail(inputEvent.target.value); if (error) setError(null); }} />
            <p className="guest-field-hint" id="guest-email-hint">Seu e-mail identifica o seu perfil neste casamento.</p>
            <label className="legal-checkbox guest-legal-checkbox">
              <input type="checkbox" checked={acceptedTerms} disabled={isSubmitting} onChange={(inputEvent) => setAcceptedTerms(inputEvent.target.checked)} />
              <span>Li e concordo com os <Link href="/termos-de-uso" target="_blank">Termos de Uso</Link>.</span>
            </label>
            <label className="legal-checkbox guest-legal-checkbox">
              <input type="checkbox" checked={acknowledgedPrivacy} disabled={isSubmitting} onChange={(inputEvent) => setAcknowledgedPrivacy(inputEvent.target.checked)} />
              <span>Li a <Link href="/privacidade" target="_blank">Política de Privacidade</Link>.</span>
            </label>
            {error ? <p className="entry-error" id="guest-entry-error" role="alert">{error}</p> : null}
            <button type="submit" disabled={isSubmitting}>{isSubmitting ? "Entrando…" : <>Entrar no jogo <span aria-hidden="true">→</span></>}</button>
            {savedGuests.length ? <button type="button" className="entry-back-button" onClick={() => setShowEntryForm(false)} disabled={isSubmitting}>Voltar para os perfis deste aparelho</button> : null}
          </form>
        )}
      </section>
      <p className="welcome-footer">Os perfis ficam separados por casamento. Você pode trocar de convidado neste aparelho a qualquer momento.</p>
    </main>
  );
}
