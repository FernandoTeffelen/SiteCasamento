/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import type { AdminGalleryPhoto } from "@/server/admin/admin-weddings.service";

type GalleryResponse = {
  wedding: { id: string; name: string; brideName: string; groomName: string };
  photos: AdminGalleryPhoto[];
  filters: {
    guests: Array<{ id: string; name: string }>;
    missions: Array<{ id: string; title: string }>;
  };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export function AdminWeddingGallery({
  wedding,
  onClose,
}: {
  wedding: { id: string; name: string };
  onClose: () => void;
}) {
  const [gallery, setGallery] = useState<GalleryResponse | null>(null);
  const [guestId, setGuestId] = useState("");
  const [missionId, setMissionId] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPhoto, setSelectedPhoto] = useState<AdminGalleryPhoto | null>(null);
  const [loadedRequestKey, setLoadedRequestKey] = useState("");
  const [requestError, setRequestError] = useState<{ key: string; message: string } | null>(null);

  const requestKey = `${wedding.id}:${page}:${guestId}:${missionId}`;
  const error = requestError?.key === requestKey ? requestError.message : null;
  const isLoading = loadedRequestKey !== requestKey && error === null;

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ page: String(page), pageSize: "24" });
    if (guestId) query.set("guestId", guestId);
    if (missionId) query.set("missionId", missionId);

    fetch(`/api/admin/weddings/${encodeURIComponent(wedding.id)}/gallery?${query.toString()}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Nao foi possivel carregar a galeria.");
        return (await response.json()) as GalleryResponse;
      })
      .then((result) => {
        setGallery(result);
        setLoadedRequestKey(requestKey);
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setRequestError({ key: requestKey, message: "Nao foi possivel carregar a galeria agora." });
      });

    return () => controller.abort();
  }, [guestId, missionId, page, requestKey, wedding.id]);

  function handleGuestChange(value: string) {
    setGuestId(value);
    setPage(1);
  }

  function handleMissionChange(value: string) {
    setMissionId(value);
    setPage(1);
  }

  const totalPages = gallery?.pagination.totalPages ?? 1;

  return (
    <div className="admin-gallery-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="admin-gallery-modal" role="dialog" aria-modal="true" aria-labelledby="admin-gallery-title">
        <header className="admin-gallery-header">
          <div>
            <span className="admin-gallery-kicker">Book / Galeria</span>
            <h2 id="admin-gallery-title">{wedding.name}</h2>
            <p>Fotos recebidas neste casamento, mesmo apos o fim do link publico.</p>
          </div>
          <button type="button" className="admin-gallery-close" onClick={onClose} aria-label="Fechar galeria">&times;</button>
        </header>

        <div className="admin-gallery-filters">
          <label>
            Convidado
            <select value={guestId} onChange={(event) => handleGuestChange(event.target.value)}>
              <option value="">Todos os convidados</option>
              {gallery?.filters.guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>)}
            </select>
          </label>
          <label>
            Missao
            <select value={missionId} onChange={(event) => handleMissionChange(event.target.value)}>
              <option value="">Todas as missoes</option>
              {gallery?.filters.missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.title}</option>)}
            </select>
          </label>
        </div>

        {isLoading && <div className="admin-gallery-state">Carregando fotos...</div>}
        {error && <div className="admin-gallery-state admin-gallery-error">{error}</div>}
        {!isLoading && !error && gallery && gallery.photos.length === 0 && (
          <div className="admin-gallery-state">Nenhuma foto encontrada com esses filtros.</div>
        )}
        {!isLoading && !error && gallery && gallery.photos.length > 0 && (
          <>
            <div className="admin-gallery-summary">{gallery.pagination.total} foto{gallery.pagination.total === 1 ? "" : "s"}</div>
            <div className="admin-gallery-grid">
              {gallery.photos.map((photo) => (
                <button
                  type="button"
                  className="admin-gallery-photo"
                  key={photo.id}
                  onClick={() => setSelectedPhoto(photo)}
                  title={`Abrir foto de ${photo.guestName}`}
                >
                  <img src={`/api/admin/photos/${encodeURIComponent(photo.id)}`} alt={photo.missionTitle} loading="lazy" decoding="async" />
                  <span className="admin-gallery-photo-caption">
                    <strong>{photo.guestName}</strong>
                    <small>{photo.missionTitle}</small>
                  </span>
                </button>
              ))}
            </div>
            <nav className="admin-gallery-pagination" aria-label="Paginacao da galeria">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isLoading}>Anterior</button>
              <span>Pagina {page} de {totalPages}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || isLoading}>Proxima</button>
            </nav>
          </>
        )}
      </section>

      {selectedPhoto && (
        <div className="admin-gallery-lightbox" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedPhoto(null);
        }}>
          <button type="button" className="admin-gallery-lightbox-close" onClick={() => setSelectedPhoto(null)} aria-label="Fechar foto ampliada">&times;</button>
          <img src={`/api/admin/photos/${encodeURIComponent(selectedPhoto.id)}`} alt={selectedPhoto.missionTitle} />
          <div className="admin-gallery-lightbox-caption">
            <strong>{selectedPhoto.guestName}</strong>
            <span>{selectedPhoto.missionTitle}</span>
          </div>
        </div>
      )}
    </div>
  );
}
