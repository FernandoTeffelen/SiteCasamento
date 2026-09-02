"use client";

import Link from "next/link";
import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { EventView } from "@/features/event/types";
import { getLocalGuestName, getLocalGuestToken } from "@/lib/guest/local-guest";
import { listQueuedPhotos, queuePhoto } from "@/lib/offline/photo-queue";

type Mission = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  displayOrder: number;
  maxSubmissions: number | null;
  completed: boolean;
  submissionCount: number;
};

type PhotoPreview = {
  file: File;
  missionId: string;
  url: string;
};

type ApiError = { error?: { message?: string } };

function readApiError(payload: ApiError, fallback: string) {
  return payload.error?.message ?? fallback;
}

export function GameClient({ event }: { event: EventView }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [guestName, setGuestName] = useState("Convidado");
  const [guestToken, setGuestToken] = useState("");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [localPhotoCounts, setLocalPhotoCounts] = useState<Record<string, number>>({});
  const [score, setScore] = useState(0);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PhotoPreview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingPhoto, setIsSavingPhoto] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  useEffect(() => {
    let isMounted = true;
    const savedToken = getLocalGuestToken(event.publicId);

    if (!savedToken) {
      router.replace(`/evento/${encodeURIComponent(event.identifier)}`);
      return () => {
        isMounted = false;
      };
    }

    async function loadGame() {
      try {
        const encodedIdentifier = encodeURIComponent(event.identifier);
        const encodedGuestToken = encodeURIComponent(savedToken);
        const [missionsResponse, scoreResponse, storedPhotos] = await Promise.all([
          fetch(`/api/events/${encodedIdentifier}/missions?guestToken=${encodedGuestToken}`),
          fetch(`/api/events/${encodedIdentifier}/guests/me?guestToken=${encodedGuestToken}`),
          listQueuedPhotos(event.publicId),
        ]);
        const missionsPayload = await missionsResponse.json() as { missions?: Mission[]; guest?: { name?: string } } & ApiError;
        const scorePayload = await scoreResponse.json() as { score?: number; guest?: { name?: string } } & ApiError;

        if (!missionsResponse.ok) throw new Error(readApiError(missionsPayload, "Não foi possível carregar as missões."));
        if (!scoreResponse.ok) throw new Error(readApiError(scorePayload, "Não foi possível carregar a pontuação."));
        if (!isMounted) return;

        const photoCounts = storedPhotos.reduce<Record<string, number>>((counts, photo) => {
          counts[photo.missionId] = (counts[photo.missionId] ?? 0) + 1;
          return counts;
        }, {});

        setGuestToken(savedToken);
        const fallbackGuestName = getLocalGuestName(event.publicId) || "Convidado";
        setGuestName(scorePayload.guest?.name ?? missionsPayload.guest?.name ?? fallbackGuestName);
        setMissions(missionsPayload.missions ?? []);
        setScore(scorePayload.score ?? 0);
        setLocalPhotoCounts(photoCounts);
      } catch (error) {
        if (isMounted) setLoadError(error instanceof Error ? error.message : "Não foi possível carregar o jogo.");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadGame();
    return () => {
      isMounted = false;
    };
  }, [event.identifier, event.publicId, router]);

  const completedMissions = missions.filter((mission) => mission.completed).length;
  const totalPhotos = Object.values(localPhotoCounts).reduce((total, count) => total + count, 0);
  const guestInitial = Array.from(guestName.trim())[0]?.toLocaleUpperCase("pt-BR") ?? "C";

  function openCamera(missionId: string) {
    setActiveMissionId(missionId);
    setSaveError(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  function showPreview(inputEvent: ChangeEvent<HTMLInputElement>) {
    const file = inputEvent.target.files?.[0];
    if (!file || !activeMissionId) return;
    setPreview({ file, missionId: activeMissionId, url: URL.createObjectURL(file) });
  }

  async function acceptPhoto() {
    if (!preview || !guestToken) return;
    const mission = missions.find((item) => item.id === preview.missionId);
    if (!mission) return;

    setIsSavingPhoto(true);
    setSaveError(null);
    setNotice(null);
    let storedLocally = false;

    try {
      await queuePhoto({
        eventPublicId: event.publicId,
        missionId: mission.id,
        missionTitle: mission.title,
        guestToken,
        file: preview.file,
        contentType: preview.file.type || "image/jpeg",
      });
      storedLocally = true;
      setLocalPhotoCounts((counts) => ({ ...counts, [mission.id]: (counts[mission.id] ?? 0) + 1 }));

      const response = await fetch(
        `/api/events/${encodeURIComponent(event.identifier)}/missions/${encodeURIComponent(mission.id)}/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ guestToken }),
        },
      );
      const payload = await response.json() as {
        score?: number;
        awardedNow?: boolean;
        error?: { message?: string };
      };

      if (!response.ok) throw new Error(readApiError(payload, "Não foi possível registrar a missão."));

      setScore(payload.score ?? score);
      setMissions((currentMissions) => currentMissions.map((item) => (
        item.id === mission.id
          ? { ...item, completed: true, submissionCount: item.submissionCount + 1 }
          : item
      )));
      setPreview(null);
    } catch (error) {
      if (storedLocally) {
        setPreview(null);
        setNotice("Foto guardada neste aparelho. A conclusão ainda não foi registrada no servidor.");
      } else {
        setSaveError(error instanceof Error ? error.message : "Não foi possível guardar a foto neste aparelho.");
      }
    } finally {
      setIsSavingPhoto(false);
    }
  }

  function takeAgain() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  }

  if (isLoading) {
    return <main className="game-screen"><p className="photos-feedback">Carregando o jogo…</p></main>;
  }

  if (loadError) {
    return (
      <main className="game-screen">
        <p className="photos-feedback photos-error" role="alert">{loadError}</p>
        <Link className="back-link" href={`/evento/${encodeURIComponent(event.identifier)}`}>Voltar para o início</Link>
      </main>
    );
  }

  return (
    <main className="game-screen">
      <input
        ref={fileInputRef}
        className="camera-input"
        type="file"
        accept="image/*"
        capture="environment"
        onChange={showPreview}
        tabIndex={-1}
      />

      <header className="game-header">
        <div>
          <p className="game-event-name">{event.brideName} &amp; {event.groomName}</p>
          <h1>Olá, {guestName}!</h1>
        </div>
        <div className="guest-avatar" aria-label={`Perfil de ${guestName}`}>{guestInitial}</div>
      </header>

      <section className="score-card" aria-label="Seu placar">
        <div>
          <p>Seu placar</p>
          <strong>{score} <span>pontos</span></strong>
        </div>
        <div className="score-progress">
          <span>{completedMissions} de {missions.length}</span>
          <span>missões concluídas</span>
        </div>
      </section>

      <Link className="photos-shortcut" href={`/evento/${encodeURIComponent(event.identifier)}/fotos`}>
        <span aria-hidden="true">▣</span> Minhas fotos
        {totalPhotos > 0 ? <span className="photos-shortcut-count">{totalPhotos}</span> : null}
        <span aria-hidden="true">→</span>
      </Link>

      {notice ? <p className="game-notice" role="status">{notice}</p> : null}

      <section className="missions-section" aria-labelledby="missions-heading">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Jogo de fotos</p>
            <h2 id="missions-heading">Missões para você</h2>
          </div>
          <span className="mission-count">{missions.length}</span>
        </div>

        <div className="mission-list">
          {missions.map((mission) => {
            const localPhotoCount = localPhotoCounts[mission.id] ?? 0;
            const photoCount = Math.max(mission.submissionCount, localPhotoCount);

            return (
              <article className={`mission-card ${mission.completed ? "mission-card-completed" : ""}`} key={mission.id}>
                <div className="mission-card-top">
                  <span className="mission-icon" aria-hidden="true">📷</span>
                  {mission.completed ? (
                    <span className="mission-status">
                      <span aria-hidden="true">✓</span> Concluída · {photoCount} {photoCount === 1 ? "foto" : "fotos"}
                    </span>
                  ) : localPhotoCount > 0 ? (
                    <span className="mission-status mission-status-pending">Foto guardada localmente</span>
                  ) : (
                    <span className="mission-status mission-status-pending">Disponível</span>
                  )}
                </div>

                <h3>{mission.title}</h3>
                {mission.description ? <p>{mission.description}</p> : null}

                <div className="mission-action">
                  <span><strong>+{mission.points}</strong> pontos · uma vez</span>
                  <button type="button" onClick={() => openCamera(mission.id)}>
                    {photoCount > 0 ? "Adicionar outra foto" : "Tirar foto"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {preview ? (
        <section className="photo-preview-overlay" role="dialog" aria-modal="true" aria-labelledby="preview-title">
          <div className="photo-preview-sheet">
            <p className="preview-kicker">Prévia da foto</p>
            <h2 id="preview-title">Gostou do registro?</h2>
            {/* A prévia usa uma URL blob local; ela não pode passar pelo otimizador do Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="photo-preview-image" src={preview.url} alt="Prévia da foto tirada para a missão" />
            <div className="photo-preview-actions">
              <button className="use-photo-button" type="button" onClick={acceptPhoto} disabled={isSavingPhoto}>
                {isSavingPhoto ? "Guardando foto…" : "Usar foto"}
              </button>
              <button className="retake-photo-button" type="button" onClick={takeAgain} disabled={isSavingPhoto}>
                Tirar novamente
              </button>
            </div>
            {saveError ? <p className="preview-error" role="alert">{saveError}</p> : null}
            <p className="preview-note">A foto fica neste aparelho; o upload do arquivo será implementado depois.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}
