"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";

export type GuestProfile = {
  name: string;
  email: string | null;
  age: number | null;
  relationshipToCouple: string | null;
  hasAvatar: boolean;
  updatedAt: string | Date;
};

type ProfileResponse = { guest?: GuestProfile; error?: { message?: string } };

function getInitial(name: string) {
  return Array.from(name.trim())[0]?.toLocaleUpperCase("pt-BR") ?? "C";
}

function avatarUrl(eventIdentifier: string, guestToken: string, updatedAt: string | Date) {
  const version = new Date(updatedAt).getTime();
  return `/api/events/${encodeURIComponent(eventIdentifier)}/guests/me/avatar?guestToken=${encodeURIComponent(guestToken)}&v=${version}`;
}

export function GuestProfileButton({
  eventIdentifier,
  guestToken,
  profile,
  onSaved,
  onSignOut,
}: {
  eventIdentifier: string;
  guestToken: string;
  profile: GuestProfile;
  onSaved(profile: GuestProfile): void;
  onSignOut(): void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email ?? "");
  const [age, setAge] = useState(profile.age?.toString() ?? "");
  const [relationshipToCouple, setRelationshipToCouple] = useState(profile.relationshipToCouple ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [shouldClearAvatar, setShouldClearAvatar] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const savedAvatarUrl = useMemo(
    () => avatarUrl(eventIdentifier, guestToken, profile.updatedAt),
    [eventIdentifier, guestToken, profile.updatedAt],
  );

  useEffect(() => () => {
    if (avatarPreviewUrl) URL.revokeObjectURL(avatarPreviewUrl);
  }, [avatarPreviewUrl]);

  function resetForm() {
    setName(profile.name);
    setEmail(profile.email ?? "");
    setAge(profile.age?.toString() ?? "");
    setRelationshipToCouple(profile.relationshipToCouple ?? "");
    setShouldClearAvatar(false);
    setAvatarFile(null);
    setAvatarPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setError(null);
  }

  function closeProfile() {
    if (isSaving) return;
    resetForm();
    setIsOpen(false);
  }

  function chooseAvatar(inputEvent: ChangeEvent<HTMLInputElement>) {
    const file = inputEvent.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setShouldClearAvatar(false);
    setAvatarPreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return URL.createObjectURL(file);
    });
  }

  async function saveProfile(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("guestToken", guestToken);
      formData.set("name", name);
      formData.set("email", email.trim());
      formData.set("age", age.trim());
      formData.set("relationshipToCouple", relationshipToCouple.trim());
      if (avatarFile) formData.set("avatar", avatarFile);
      if (shouldClearAvatar) formData.set("clearAvatar", "true");

      const response = await fetch(`/api/events/${encodeURIComponent(eventIdentifier)}/guests/me`, {
        method: "PATCH",
        body: formData,
      });
      const payload = await response.json() as ProfileResponse;
      if (!response.ok || !payload.guest) {
        throw new Error(payload.error?.message ?? "Não foi possível salvar seu perfil.");
      }
      onSaved(payload.guest);
      setIsOpen(false);
      setName(payload.guest.name);
      setEmail(payload.guest.email ?? "");
      setAge(payload.guest.age?.toString() ?? "");
      setRelationshipToCouple(payload.guest.relationshipToCouple ?? "");
      setShouldClearAvatar(false);
      setAvatarFile(null);
      setAvatarPreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível salvar seu perfil.");
    } finally {
      setIsSaving(false);
    }
  }

  const showSavedAvatar = profile.hasAvatar && !shouldClearAvatar && !avatarPreviewUrl;
  const shownAvatarUrl = avatarPreviewUrl ?? (showSavedAvatar ? savedAvatarUrl : null);

  return (
    <>
      <button
        className="guest-avatar"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Abrir perfil de ${profile.name}`}
      >
        {profile.hasAvatar ? (
          // A rota é autorizada pelo token do convidado; não há URL pública persistida.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={savedAvatarUrl} alt="" />
        ) : getInitial(profile.name)}
      </button>

      {isOpen ? (
        <section className="profile-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <div className="profile-sheet">
            <div className="profile-sheet-heading">
              <div>
                <p>Seu perfil</p>
                <h2 id="profile-title">Olá, {profile.name}</h2>
              </div>
              <button type="button" onClick={closeProfile} aria-label="Fechar perfil" disabled={isSaving}>×</button>
            </div>

            <form className="profile-form" onSubmit={saveProfile} noValidate>
              <div className="profile-avatar-editor">
                <div className="profile-avatar-preview" aria-label="Prévia do seu avatar">
                  {shownAvatarUrl ? (
                    // A prévia local não passa pelo otimizador do Next.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={shownAvatarUrl} alt="Sua foto de perfil" />
                  ) : getInitial(name)}
                </div>
                <div>
                  <label className="profile-photo-picker">
                    Escolher foto
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={chooseAvatar} disabled={isSaving} />
                  </label>
                  {profile.hasAvatar || avatarFile ? (
                    <button
                      className="profile-remove-avatar"
                      type="button"
                      disabled={isSaving}
                      onClick={() => {
                        setAvatarFile(null);
                        setShouldClearAvatar(true);
                        setAvatarPreviewUrl((currentUrl) => {
                          if (currentUrl) URL.revokeObjectURL(currentUrl);
                          return null;
                        });
                      }}
                    >
                      Usar inicial
                    </button>
                  ) : <p>Opcional. Uma inicial será usada se você não escolher uma foto.</p>}
                </div>
              </div>

              <label htmlFor="profile-name">Como podemos te chamar?</label>
              <input
                id="profile-name"
                type="text"
                value={name}
                maxLength={40}
                autoCapitalize="words"
                autoComplete="name"
                disabled={isSaving}
                onChange={(inputEvent) => setName(inputEvent.target.value)}
              />

              <label htmlFor="profile-email">E-mail de identificação</label>
              <input
                id="profile-email"
                type="email"
                value={email}
                maxLength={254}
                autoComplete="email"
                inputMode="email"
                required
                disabled={isSaving}
                onChange={(inputEvent) => setEmail(inputEvent.target.value)}
              />

              <label htmlFor="profile-age">Idade <span>opcional</span></label>
              <input
                id="profile-age"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Ex.: 28"
                value={age}
                maxLength={3}
                disabled={isSaving}
                onChange={(inputEvent) => setAge(inputEvent.target.value.replace(/\D/g, ""))}
              />

              <label htmlFor="profile-relationship">Como você conhece o casal? <span>opcional</span></label>
              <textarea
                id="profile-relationship"
                rows={3}
                maxLength={120}
                placeholder="Ex.: Sou amiga da noiva"
                value={relationshipToCouple}
                disabled={isSaving}
                onChange={(inputEvent) => setRelationshipToCouple(inputEvent.target.value)}
              />

              {error ? <p className="profile-error" role="alert">{error}</p> : null}
              <button className="profile-save" type="submit" disabled={isSaving}>
                {isSaving ? "Salvando…" : "Salvar perfil"}
              </button>
              <button className="profile-cancel" type="button" onClick={closeProfile} disabled={isSaving}>Cancelar</button>
              <button className="profile-sign-out" type="button" onClick={onSignOut} disabled={isSaving}>Sair e trocar convidado</button>
            </form>
          </div>
        </section>
      ) : null}
    </>
  );
}
