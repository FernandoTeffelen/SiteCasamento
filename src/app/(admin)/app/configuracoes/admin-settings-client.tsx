"use client";

import { useState, useTransition } from "react";

type UserInfo = { name: string; email: string };

export function AdminSettingsClient({ user }: { user: UserInfo }) {
  const [tab, setTab] = useState<"profile" | "password" | "subscription">("profile");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Profile fields
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function resetFeedback() {
    setSuccess(null);
    setError(null);
  }

  function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email }),
        });
        const json = (await res.json()) as { user?: UserInfo; error?: { message?: string } };
        if (!res.ok) { setError(json.error?.message ?? "Erro ao salvar."); return; }
        setSuccess("Perfil atualizado com sucesso.");
      } catch { setError("Erro de conexão."); }
    });
  }

  function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    if (newPassword.length < 12) { setError("A nova senha deve ter pelo menos 12 caracteres."); return; }
    if (newPassword !== confirmPassword) { setError("As senhas não coincidem."); return; }
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const json = (await res.json()) as { error?: { message?: string } };
        if (!res.ok) { setError(json.error?.message ?? "Erro ao alterar senha."); return; }
        setSuccess("Senha alterada com sucesso.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } catch { setError("Erro de conexão."); }
    });
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <h1>⚙️ Configurações da Conta</h1>
          <p>Gerencie seu perfil, senha e assinatura.</p>
        </div>

        {/* Tabs */}
        <div className="settings-tabs">
          <button
            type="button"
            className={`settings-tab ${tab === "profile" ? "active" : ""}`}
            onClick={() => { setTab("profile"); resetFeedback(); }}
          >
            👤 Perfil
          </button>
          <button
            type="button"
            className={`settings-tab ${tab === "password" ? "active" : ""}`}
            onClick={() => { setTab("password"); resetFeedback(); }}
          >
            🔒 Senha
          </button>
          <button
            type="button"
            className={`settings-tab ${tab === "subscription" ? "active" : ""}`}
            onClick={() => { setTab("subscription"); resetFeedback(); }}
          >
            💳 Assinatura
          </button>
        </div>

        {/* Feedback */}
        {success && <div className="settings-success-banner">{success}</div>}
        {error && <div className="form-error-banner">{error}</div>}

        {/* Aba Perfil */}
        {tab === "profile" && (
          <form className="settings-form" onSubmit={handleProfileSave}>
            <div className="form-group">
              <label htmlFor="s-name">Nome</label>
              <input
                id="s-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="s-email">E-mail</label>
              <input
                id="s-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="settings-form-actions">
              <button type="submit" className="admin-btn-primary" disabled={isPending}>
                {isPending ? "Salvando..." : "Salvar Alterações"}
              </button>
            </div>
          </form>
        )}

        {/* Aba Senha */}
        {tab === "password" && (
          <form className="settings-form" onSubmit={handlePasswordSave}>
            <div className="form-group">
              <label htmlFor="s-current">Senha Atual</label>
              <input
                id="s-current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="s-new">Nova Senha <span className="label-hint">(mínimo 12 caracteres)</span></label>
              <input
                id="s-new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="s-confirm">Confirmar Nova Senha</label>
              <input
                id="s-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="settings-form-actions">
              <button type="submit" className="admin-btn-primary" disabled={isPending}>
                {isPending ? "Alterando..." : "Alterar Senha"}
              </button>
            </div>
          </form>
        )}

        {/* Aba Assinatura */}
        {tab === "subscription" && (
          <div className="settings-subscription-info">
            <div className="subscription-plan-card">
              <div className="plan-icon">💳</div>
              <div>
                <strong>Plano Atual</strong>
                <p>Gerenciamento de assinatura e pagamentos estarão disponíveis em breve nesta área.</p>
                <p className="plan-hint">
                  Em produção, esta seção exibirá seu plano ativo, data de renovação e opções para upgrade ou cancelamento.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Voltar */}
        <div className="settings-back">
          <a href="/app" className="link-back-home">← Voltar ao Painel</a>
        </div>
      </div>
    </div>
  );
}
