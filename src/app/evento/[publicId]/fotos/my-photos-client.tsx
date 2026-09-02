"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EventView } from "@/features/event/types";
import { getLocalGuestToken } from "@/lib/guest/local-guest";
import { deleteQueuedPhoto, listQueuedPhotos } from "@/lib/offline/photo-queue";
import type { QueuedPhotoUpload } from "@/lib/offline/types";
import { uploadPendingPhotos, uploadQueuedPhoto, type UploadAttemptResult } from "@/lib/offline/upload-queue";

type LocalPhoto = QueuedPhotoUpload & { previewUrl: string };

function getStatus(status: QueuedPhotoUpload["status"]) {
  if (status === "uploaded") return { label: "Enviada", className: "photo-status-sent", icon: "✓" };
  if (status === "uploading") return { label: "Enviando", className: "photo-status-pending", icon: "◌" };
  if (status === "failed") return { label: "Falhou", className: "photo-status-failed", icon: "!" };
  return { label: "Aguardando envio", className: "photo-status-pending", icon: "◷" };
}

export function MyPhotosClient({ event }: { event: EventView }) {
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<LocalPhoto | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [retryingPhotoId, setRetryingPhotoId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const objectUrls: string[] = [];
    const guestToken = getLocalGuestToken(event.publicId);

    void listQueuedPhotos(event.publicId, guestToken || undefined)
      .then((storedPhotos) => {
        const localPhotos = storedPhotos.map((photo) => {
          const previewUrl = URL.createObjectURL(photo.file);
          objectUrls.push(previewUrl);
          return { ...photo, previewUrl };
        });

        if (!isMounted) {
          objectUrls.forEach((url) => URL.revokeObjectURL(url));
          return;
        }

        setPhotos(localPhotos);
        void uploadPendingPhotos(event.identifier, event.publicId, guestToken || undefined, (result) => {
          if (!isMounted) return;
          applyUploadResult(result);
        });
      })
      .catch(() => {
        if (isMounted) setLoadError("Não foi possível acessar as fotos guardadas neste aparelho.");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [event.identifier, event.publicId]);

  function applyUploadResult(result: UploadAttemptResult) {
    setPhotos((currentPhotos) => currentPhotos.map((photo) => (
      photo.id === result.photo.id ? { ...result.photo, previewUrl: photo.previewUrl } : photo
    )));
    setFeedback(result.ok ? "Foto enviada com sucesso." : result.message);
  }

  const photoGroups = photos.reduce<Array<{ missionId: string; missionTitle: string; photos: LocalPhoto[] }>>(
    (groups, photo) => {
      const existingGroup = groups.find((group) => group.missionId === photo.missionId);
      if (existingGroup) existingGroup.photos.push(photo);
      else groups.push({ missionId: photo.missionId, missionTitle: photo.missionTitle, photos: [photo] });
      return groups;
    },
    [],
  );

  async function deletePhoto(photo: LocalPhoto) {
    const hasRemoteSubmission = Boolean(photo.remoteSubmissionId);
    const deletesRemotePhoto = photo.status === "uploaded" && hasRemoteSubmission;
    const confirmed = window.confirm(
      deletesRemotePhoto
        ? "Excluir esta foto do evento e deste aparelho? Os pontos desta missão também serão recalculados."
        : "Excluir esta cópia do aparelho?",
    );
    if (!confirmed) return;

    setDeletingPhotoId(photo.id);
    setLoadError(null);

    try {
      const deleteUrl = hasRemoteSubmission
        ? `/api/events/${encodeURIComponent(event.identifier)}/missions/${encodeURIComponent(photo.missionId)}/submissions/${encodeURIComponent(photo.remoteSubmissionId as string)}?guestToken=${encodeURIComponent(photo.guestToken)}`
        : `/api/events/${encodeURIComponent(event.identifier)}/missions/${encodeURIComponent(photo.missionId)}/submissions?guestToken=${encodeURIComponent(photo.guestToken)}&uploadId=${encodeURIComponent(photo.id)}`;
      const response = await fetch(deleteUrl, { method: "DELETE" });
      const payload = await response.json() as { error?: { message?: string } };
      // Fotos pendentes que nunca chegaram ao servidor retornam 404; nesse caso
      // basta remover a cópia local. A versão antiga pode ser localizada pelo
      // fallback de clientUploadId no backend.
      if (!response.ok && response.status !== 404) {
        throw new Error(payload.error?.message ?? "Não foi possível excluir a foto do evento.");
      }

      await deleteQueuedPhoto(photo.id);
      setPhotos((currentPhotos) => currentPhotos.filter((item) => item.id !== photo.id));
      if (selectedPhoto?.id === photo.id) setSelectedPhoto(null);
      URL.revokeObjectURL(photo.previewUrl);
    } catch {
      setLoadError("Não foi possível excluir a foto. Tente novamente.");
    } finally {
      setDeletingPhotoId(null);
    }
  }

  async function retryPhoto(photo: LocalPhoto) {
    setRetryingPhotoId(photo.id);
    setFeedback(null);
    setPhotos((currentPhotos) => currentPhotos.map((item) => (
      item.id === photo.id ? { ...item, status: "uploading", lastError: undefined } : item
    )));

    try {
      const result = await uploadQueuedPhoto(event.identifier, photo);
      applyUploadResult(result);
    } catch {
      setFeedback("Não foi possível iniciar o envio. Sua foto continua guardada neste aparelho.");
    } finally {
      setRetryingPhotoId(null);
    }
  }

  return (
    <main className="my-photos-screen">
      <header className="photos-header">
        <Link className="back-link" href={`/evento/${encodeURIComponent(event.identifier)}/jogo`}>← Jogo</Link>
        <p className="game-event-name">{event.brideName} &amp; {event.groomName}</p>
        <h1>Minhas fotos</h1>
        <p>Você pode guardar várias fotos por missão. Os pontos da missão contam apenas uma vez.</p>
      </header>

      {isLoading ? <p className="photos-feedback">Carregando suas fotos…</p> : null}
      {loadError ? <p className="photos-feedback photos-error" role="alert">{loadError}</p> : null}
      {feedback ? <p className="photos-feedback" role="status">{feedback}</p> : null}

      {!isLoading && !loadError && photos.length === 0 ? (
        <section className="empty-photos">
          <span aria-hidden="true">📷</span>
          <h2>Nenhuma foto ainda</h2>
          <p>Quando você confirmar uma foto em uma missão, ela aparecerá aqui aguardando envio.</p>
          <Link href={`/evento/${encodeURIComponent(event.identifier)}/jogo`}>Ver missões</Link>
        </section>
      ) : null}

      {photoGroups.length > 0 ? (
        <div className="photo-groups">
          {photoGroups.map((group) => (
            <section className="mission-photo-group" key={group.missionId} aria-labelledby={`group-${group.missionId}`}>
              <div className="photo-group-heading">
                <h2 id={`group-${group.missionId}`}>{group.missionTitle}</h2>
                <span>{group.photos.length} {group.photos.length === 1 ? "foto" : "fotos"}</span>
              </div>

              <div className="saved-photo-list">
                {group.photos.map((photo, index) => {
                  const status = getStatus(photo.status);
                  const isDeleting = deletingPhotoId === photo.id;
                  const isRetrying = retryingPhotoId === photo.id;

                  return (
                    <article className="saved-photo-card" key={photo.id}>
                      {/* A imagem é uma URL blob local, portanto não passa pelo otimizador do Next. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.previewUrl} alt={`Foto ${index + 1} da missão ${photo.missionTitle}`} />
                      <div className="saved-photo-content">
                        <p className="saved-photo-mission">Foto {index + 1}</p>
                        <span className={`photo-status ${status.className}`}>
                          <span aria-hidden="true">{status.icon}</span> {status.label}
                        </span>
                        {photo.lastError ? <p className="photo-last-error">{photo.lastError}</p> : null}
                        <div className="saved-photo-actions">
                          <button type="button" onClick={() => setSelectedPhoto(photo)}>Abrir foto</button>
                          {photo.status !== "uploaded" && photo.status !== "uploading" ? (
                            <button type="button" onClick={() => void retryPhoto(photo)} disabled={isRetrying}>
                              {isRetrying ? "Enviando…" : photo.status === "failed" ? "Tentar novamente" : "Enviar agora"}
                            </button>
                          ) : null}
                          <button
                            className="delete-photo-button"
                            type="button"
                            onClick={() => void deletePhoto(photo)}
                            disabled={isDeleting}
                          >
                            {isDeleting ? "Excluindo…" : "Excluir"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}

      {selectedPhoto ? (
        <section className="photo-viewer-overlay" role="dialog" aria-modal="true" aria-labelledby="photo-viewer-title">
          <div className="photo-viewer">
            <div className="photo-viewer-heading">
              <div>
                <p>Visualizando foto</p>
                <h2 id="photo-viewer-title">{selectedPhoto.missionTitle}</h2>
              </div>
              <button type="button" onClick={() => setSelectedPhoto(null)} aria-label="Fechar foto">×</button>
            </div>
            {/* A imagem é uma URL blob local, portanto não passa pelo otimizador do Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selectedPhoto.previewUrl} alt={`Foto ampliada da missão ${selectedPhoto.missionTitle}`} />
            <button className="close-photo-viewer" type="button" onClick={() => setSelectedPhoto(null)}>Fechar</button>
          </div>
        </section>
      ) : null}
    </main>
  );
}
