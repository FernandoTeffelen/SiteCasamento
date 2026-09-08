/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, useTransition } from "react";
import { WeddingQrCode } from "@/features/wedding/wedding-qr-code";
import type { AdminDashboardWedding } from "@/server/admin/admin-weddings.service";
import { AdminWeddingGallery } from "./admin-wedding-gallery";

type DashboardData = {
  organization: { id: string; name: string; balance: number };
  weddings: AdminDashboardWedding[];
};

export function AdminDashboardClient({
  initialData,
  userName,
  userEmail,
}: {
  initialData: DashboardData;
  userName: string;
  userEmail: string;
}) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [newlyCreatedWedding, setNewlyCreatedWedding] = useState<AdminDashboardWedding | null>(null);
  const [qrWedding, setQrWedding] = useState<AdminDashboardWedding | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [weddingToDelete, setWeddingToDelete] = useState<AdminDashboardWedding | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [accessChangeId, setAccessChangeId] = useState<string | null>(null);

  // Form states
  const [brideName, setBrideName] = useState("");
  const [groomName, setGroomName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Photo viewer modal
  const [selectedPhoto, setSelectedPhoto] = useState<{ id: string; guestName: string; missionTitle: string } | null>(null);
  const [galleryWedding, setGalleryWedding] = useState<AdminDashboardWedding | null>(null);

  async function fetchLatestData() {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/admin/weddings");
      if (res.ok) {
        const json = (await res.json()) as DashboardData;
        setData(json);
      }
    } catch {
      // Falha silenciosa em background polling
    } finally {
      setIsRefreshing(false);
    }
  }

  // Auto-refresh a cada 15s silenciosamente (sem botão/toggle)
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchLatestData();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  function handleCreateWedding(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!brideName.trim() || !groomName.trim()) {
      setFormError("Informe os nomes da noiva e do noivo.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/weddings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brideName,
            groomName,
            eventDate: eventDate ? new Date(eventDate).toISOString() : null,
          }),
        });
        if (!res.ok) {
          const errJson = (await res.json()) as { error?: { message?: string } };
          setFormError(errJson.error?.message || "Erro ao criar casamento.");
          return;
        }
        setBrideName("");
        setGroomName("");
        setEventDate("");
        setShowCreateModal(false);
        const refreshRes = await fetch("/api/admin/weddings");
        if (refreshRes.ok) {
          const freshData = (await refreshRes.json()) as DashboardData;
          setData(freshData);
          setNewlyCreatedWedding(freshData.weddings[0] ?? null);
        }
      } catch {
        setFormError("Erro de conexão ao criar o casamento.");
      }
    });
  }

  function handleDeleteWedding(wedding: AdminDashboardWedding) {
    setWeddingToDelete(wedding);
    setDeletePassword("");
    setDeleteError(null);
    return;
    /*
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir o casamento "${wedding.name}"?\n\nTodos os convidados, fotos e missões deste evento serão removidos permanentemente. Esta ação não pode ser desfeita.`
    );
    if (!confirmed) return;
    startTransition(async () => {
      setDeletingId(wedding.id);
      try {
        const res = await fetch(`/api/admin/weddings/${wedding.id}`, { method: "DELETE" });
        if (res.ok) {
          setData((prev) => ({
            ...prev,
            weddings: prev.weddings.filter((w) => w.id !== wedding.id),
          }));
        }
      } catch {
        // Falha silenciosa
      } finally {
        setDeletingId(null);
      }
    });
    */
  }

  function closeDeleteWeddingModal() {
    if (deletingId) return;
    setWeddingToDelete(null);
    setDeletePassword("");
    setDeleteError(null);
  }

  function confirmDeleteWedding(e: React.FormEvent) {
    e.preventDefault();
    const wedding = weddingToDelete;
    if (!wedding) return;
    if (!deletePassword) {
      setDeleteError("Informe sua senha para confirmar a exclusão.");
      return;
    }

    startTransition(async () => {
      setDeletingId(wedding.id);
      setDeleteError(null);
      try {
        const res = await fetch(`/api/admin/weddings/${wedding.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: deletePassword }),
        });
        if (res.ok) {
          setData((prev) => ({
            ...prev,
            weddings: prev.weddings.filter((item) => item.id !== wedding.id),
          }));
          closeDeleteWeddingModal();
          return;
        }
        const errorBody = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        setDeleteError(errorBody?.error?.message ?? "Não foi possível excluir este casamento agora.");
      } catch {
        setDeleteError("Não foi possível conectar ao servidor. Tente novamente.");
      } finally {
        setDeletingId(null);
      }
    });
  }

  function handleTogglePublicAccess(wedding: AdminDashboardWedding) {
    const revoked = wedding.publicAccessRevokedAt === null;
    const action = revoked ? "revogar" : "reativar";
    if (!window.confirm(`Deseja ${action} o link público de "${wedding.name}"?`)) return;

    startTransition(async () => {
      setAccessChangeId(wedding.id);
      try {
        const res = await fetch(`/api/admin/weddings/${wedding.id}/public-access`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revoked }),
        });
        if (res.ok) await fetchLatestData();
      } finally {
        setAccessChangeId(null);
      }
    });
  }

  function copyWeddingLink(publicId: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    void navigator.clipboard.writeText(`${origin}/w/${publicId}`);
    setCopiedToken(publicId);
    setTimeout(() => setCopiedToken(null), 3000);
  }

  const totalGuests = data.weddings.reduce((acc, w) => acc + w.guestCount, 0);
  const totalPhotos = data.weddings.reduce((acc, w) => acc + w.photoCount, 0);

  return (
    <div className="admin-desktop-layout">
      {/* Navbar */}
      <header className="admin-navbar">
        <div className="admin-nav-container">
          <div className="admin-brand">
            <span className="admin-logo-badge">💍</span>
            <div>
              <span className="admin-brand-name">SiteCasamento</span>
              <span className="admin-brand-sub">Painel da Cerimonialista</span>
            </div>
          </div>

          <div className="admin-nav-actions">
            <div className="admin-org-pill">
              <span className="org-dot" />
              <span>{data.organization.name}</span>
            </div>

            <div className="admin-user-menu">
              <span className="user-greeting">
                Olá, <strong>{userName}</strong>
              </span>
              <a href="/app/configuracoes" className="admin-settings-link" title="Configurações da conta">
                ⚙️ Configurações
              </a>
              <form action="/api/admin/auth/logout" method="post">
                <button type="submit" className="logout-button">Sair</button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="admin-main-container">
        {/* Banner de Boas-vindas */}
        <section className="admin-hero-banner">
          <div className="admin-hero-text">
            <h1>Gestão de Casamentos e Experiências</h1>
            <p>Acompanhe convidados, fotos enviadas e ranking em tempo real para cada um dos seus eventos.</p>
          </div>
          <div className="admin-hero-controls">
            <button type="button" className="admin-btn-primary" onClick={() => setShowCreateModal(true)}>
              <span className="btn-icon">+</span> Criar Novo Casamento
            </button>
            <button
              type="button"
              className={`admin-btn-secondary ${isRefreshing ? "spinning" : ""}`}
              onClick={() => void fetchLatestData()}
              title="Atualizar dados agora"
            >
              🔄 {isRefreshing ? "Atualizando..." : "Atualizar"}
            </button>
          </div>
        </section>

        {/* Métricas Gerais */}
        <section className="admin-metrics-grid">
          <div className="metric-card">
            <div className="metric-icon metric-purple">💒</div>
            <div className="metric-info">
              <span className="metric-label">Casamentos</span>
              <span className="metric-value">{data.weddings.length}</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon metric-blue">👥</div>
            <div className="metric-info">
              <span className="metric-label">Convidados</span>
              <span className="metric-value">{totalGuests}</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon metric-green">📸</div>
            <div className="metric-info">
              <span className="metric-label">Fotos Recebidas</span>
              <span className="metric-value">{totalPhotos}</span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon metric-amber">✉️</div>
            <div className="metric-info">
              <span className="metric-label">Conta</span>
              <span className="metric-account-email">{userEmail}</span>
            </div>
          </div>
        </section>

        {/* Lista de Casamentos */}
        <section className="weddings-section">
          <div className="section-title-row">
            <h2>Casamentos Cadastrados ({data.weddings.length})</h2>
            <span className="section-hint">Fotos e convidados são sincronizados a cada 15 segundos.</span>
          </div>

          {data.weddings.length === 0 ? (
            <div className="empty-weddings-box">
              <span className="empty-icon">💍</span>
              <h3>Nenhum casamento criado ainda</h3>
              <p>Clique no botão acima para criar o seu primeiro evento e gerar o link do jogo.</p>
              <button type="button" className="admin-btn-primary" onClick={() => setShowCreateModal(true)}>
                Criar Meu Primeiro Casamento
              </button>
            </div>
          ) : (
            <div className="weddings-grid">
              {data.weddings.map((wedding) => {
                const origin = typeof window !== "undefined" ? window.location.origin : "";
                const weddingUrl = `${origin}/w/${wedding.publicId}`;
                const remainingPhotos = Math.max(0, wedding.photoCount - wedding.recentPhotos.length);

                return (
                  <article key={wedding.id} className="wedding-admin-card">
                    {/* Header do Card */}
                    <div className="wedding-card-header">
                      <div>
                        <span className="wedding-card-kicker">Casamento</span>
                        <h3 className="wedding-card-title">{wedding.name}</h3>
                        <p className="wedding-card-date">
                          📅 {wedding.eventDate
                            ? new Date(wedding.eventDate).toLocaleDateString("pt-BR")
                            : "Data a definir"}
                        </p>
                      </div>
                      <div className="wedding-card-header-actions">
                        <span className={`status-badge-active ${wedding.publicAccessRevokedAt ? "status-badge-revoked" : ""}`}>
                          {wedding.publicAccessRevokedAt ? "Link revogado" : "Ativo"}
                        </span>
                        <button
                          type="button"
                          className="btn-toggle-public-access"
                          onClick={() => handleTogglePublicAccess(wedding)}
                          disabled={accessChangeId === wedding.id || isPending}
                        >
                          {accessChangeId === wedding.id ? "Atualizando..." : wedding.publicAccessRevokedAt ? "Reativar link" : "Revogar link"}
                        </button>
                        <button
                          type="button"
                          className="btn-delete-wedding"
                          onClick={() => handleDeleteWedding(wedding)}
                          disabled={deletingId === wedding.id || isPending}
                          title="Excluir este casamento"
                        >
                          {deletingId === wedding.id ? "Excluindo..." : "🗑️ Excluir"}
                        </button>
                      </div>
                    </div>

                    {/* Link Seguro */}
                    <div className="wedding-link-box">
                      <span className="link-box-label">🔗 Link Seguro do Convidado:</span>
                      <div className="link-input-row">
                        <input
                          type="text"
                          readOnly
                          value={weddingUrl}
                          className="link-readonly-input"
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                        />
                        <button type="button" className="btn-copy" onClick={() => copyWeddingLink(wedding.publicId)}>
                          {copiedToken === wedding.publicId ? "✓ Copiado" : "Copiar"}
                        </button>
                        <a href={`/w/${wedding.publicId}`} target="_blank" rel="noreferrer" className="btn-open-link">
                          Abrir ↗
                        </a>
                        <button type="button" className="btn-show-qr" onClick={() => setQrWedding(wedding)}>
                          QR Code
                        </button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="wedding-stats-row">
                      <div className="stat-pill"><strong>{wedding.guestCount}</strong> convidados</div>
                      <div className="stat-pill"><strong>{wedding.photoCount}</strong> fotos enviadas</div>
                    </div>

                    <button type="button" className="admin-book-button" onClick={() => setGalleryWedding(wedding)}>
                      Abrir Book / Galeria
                    </button>

                    {/* Feed de Fotos */}
                    <div className="wedding-photos-feed">
                      <div className="feed-heading">
                        <h4>Fotos Recentes ({wedding.photoCount})</h4>
                        {wedding.photoCount > 0 && <span className="feed-live-dot" title="Sincronizando" />}
                      </div>
                      {wedding.recentPhotos.length === 0 ? (
                        <p className="empty-feed-text">Nenhuma foto enviada ainda.</p>
                      ) : (
                        <div className="photo-thumbnails-grid">
                          {wedding.recentPhotos.map((photo) => (
                            <div
                              key={photo.id}
                              className="photo-thumb-card"
                              onClick={() => setSelectedPhoto(photo)}
                              title={`${photo.guestName} — ${photo.missionTitle}`}
                            >
                              <img src={`/api/admin/photos/${photo.id}`} alt={photo.missionTitle} loading="lazy" className="admin-photo-img" />
                              <div className="photo-thumb-overlay">
                                <span className="photo-guest-badge">{photo.guestName}</span>
                              </div>
                            </div>
                          ))}
                          {remainingPhotos > 0 && (
                            <button
                              type="button"
                              className="photo-more-card"
                              onClick={() => setGalleryWedding(wedding)}
                              aria-label={`Ver mais ${remainingPhotos} fotos de ${wedding.name}`}
                            >
                              <strong>+{remainingPhotos}</strong>
                              <span>ver todas</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ranking */}
                    {wedding.topGuests.length > 0 && (
                      <div className="wedding-ranking-preview">
                        <h4>🏆 Ranking dos Convidados</h4>
                        <ul className="ranking-compact-list">
                          {wedding.topGuests.map((guest, idx) => (
                            <li key={guest.id} className="ranking-item">
                              <span className="rank-pos">#{idx + 1}</span>
                              <span className="rank-name">{guest.name}</span>
                              <strong className="rank-score">{guest.score} pts</strong>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Modal Criar Casamento */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-window" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>💍 Criar Novo Casamento</h2>
              <button type="button" className="modal-close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateWedding} className="modal-form">
              <p className="modal-subtitle">
                O sistema gerará um link privado com token seguro e 5 missões fotográficas prontas.
              </p>
              {formError && <div className="form-error-banner">{formError}</div>}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="brideName">Nome da Noiva *</label>
                  <input id="brideName" type="text" required placeholder="Ex: Ana" value={brideName} onChange={(e) => setBrideName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label htmlFor="groomName">Nome do Noivo *</label>
                  <input id="groomName" type="text" required placeholder="Ex: João" value={groomName} onChange={(e) => setGroomName(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="eventDate">Data do Casamento (Opcional)</label>
                <input id="eventDate" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                <button type="submit" className="admin-btn-primary" disabled={isPending}>
                  {isPending ? "Criando..." : "Criar e Gerar Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {newlyCreatedWedding && (
        <WeddingQrModal
          wedding={newlyCreatedWedding}
          title="Seu QR Code está pronto"
          description="Compartilhe este QR Code com os convidados para eles entrarem nas missões e enviarem fotos."
          onClose={() => setNewlyCreatedWedding(null)}
        />
      )}

      {qrWedding && (
        <WeddingQrModal
          wedding={qrWedding}
          title={`QR Code de ${qrWedding.name}`}
          description="Este QR Code leva os convidados diretamente para o acesso privado deste casamento."
          onClose={() => setQrWedding(null)}
        />
      )}

      {weddingToDelete && (
        <div className="modal-backdrop" onClick={closeDeleteWeddingModal}>
          <div className="modal-window delete-wedding-modal" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-wedding-title">
            <div className="modal-header">
              <div>
                <span className="delete-wedding-kicker">Ação permanente</span>
                <h2 id="delete-wedding-title">Excluir casamento</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={closeDeleteWeddingModal} disabled={deletingId === weddingToDelete.id} aria-label="Fechar">×</button>
            </div>
            <form onSubmit={confirmDeleteWedding} className="modal-form delete-wedding-form">
              <p className="modal-subtitle">
                Você está prestes a excluir <strong>{weddingToDelete.name}</strong>. Convidados, missões e fotos serão removidos permanentemente.
              </p>
              <div className="delete-wedding-warning">Esta ação não pode ser desfeita.</div>
              {deleteError && <div className="form-error-banner">{deleteError}</div>}
              <div className="form-group">
                <label htmlFor="deleteWeddingPassword">Confirme com sua senha</label>
                <input
                  id="deleteWeddingPassword"
                  type="password"
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Digite sua senha"
                  disabled={deletingId === weddingToDelete.id}
                  autoFocus
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={closeDeleteWeddingModal} disabled={deletingId === weddingToDelete.id}>Cancelar</button>
                <button type="submit" className="btn-confirm-delete" disabled={deletingId === weddingToDelete.id}>
                  {deletingId === weddingToDelete.id ? "Excluindo..." : "Excluir permanentemente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Visualizar Foto */}
      {selectedPhoto && (
        <div className="modal-backdrop" onClick={() => setSelectedPhoto(null)}>
          <div className="photo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-header">
              <div>
                <h3>{selectedPhoto.missionTitle}</h3>
                <p>Enviada por <strong>{selectedPhoto.guestName}</strong></p>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedPhoto(null)}>✕</button>
            </div>
            <div className="photo-modal-body">
              <img src={`/api/admin/photos/${selectedPhoto.id}`} alt={selectedPhoto.missionTitle} className="photo-modal-full-img" />
            </div>
          </div>
        </div>
      )}

      {galleryWedding && (
        <AdminWeddingGallery wedding={galleryWedding} onClose={() => setGalleryWedding(null)} />
      )}
    </div>
  );
}

function WeddingQrModal({
  wedding,
  title,
  description,
  onClose,
}: {
  wedding: AdminDashboardWedding;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop wedding-qr-backdrop" onClick={onClose}>
      <section
        className="wedding-qr-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`wedding-qr-title-${wedding.id}`}
      >
        <div className="wedding-qr-modal-header">
          <div>
            <span className="wedding-qr-kicker">Acesso dos convidados</span>
            <h2 id={`wedding-qr-title-${wedding.id}`}>{title}</h2>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar QR Code">×</button>
        </div>
        <p className="wedding-qr-description">{description}</p>
        <WeddingQrCode key={wedding.publicId} publicId={wedding.publicId} weddingName={wedding.name} />
        <div className="wedding-qr-modal-footer">
          <a href={`/w/${wedding.publicId}`} target="_blank" rel="noreferrer" className="admin-btn-open">
            Abrir experiência →
          </a>
          <button type="button" className="btn-cancel" onClick={onClose}>Voltar ao painel</button>
        </div>
      </section>
    </div>
  );
}
