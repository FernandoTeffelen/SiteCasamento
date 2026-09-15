"use client";

import { useState, useTransition } from "react";
import Link from "next/link";

type UserInfo = { name: string; email: string };
type SubscriptionSummary = {
  creditsAvailable: number;
  completedPurchases: number;
  access: {
    canAccessDashboard: boolean;
    hasCommercialHistory: boolean;
    hasActivePlan: boolean;
  };
  plan: {
    source: "SUBSCRIPTION" | "MANUAL";
    name: string;
    organizationName: string;
    status: string;
    tier: string | null;
    period: string | null;
    durationMonths: number;
    creditsPerMonth: number;
    startDate: string | null;
    endDate: string | null;
    lastCreditReleasedAt: string | null;
    nextCreditReleaseAt: string | null;
  } | null;
};

const planStatusLabels: Record<string, string> = {
  ACTIVE: "Ativo",
  PAST_DUE: "Pagamento pendente",
  CANCELED: "Cancelado",
  EXPIRED: "Encerrado",
};

function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleDateString("pt-BR") : "—";
}

export function AdminSettingsClient({ user, subscription }: { user: UserInfo; subscription: SubscriptionSummary }) {
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
  const commercialStatus = subscription.access.hasActivePlan
    ? "Plano ativo"
    : subscription.creditsAvailable > 0
      ? "Créditos disponíveis"
      : subscription.access.hasCommercialHistory
        ? "Sem plano ativo · painel mantido"
        : "Pagamento ainda não realizado";

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
    if (newPassword.length < 6) { setError("A nova senha deve ter pelo menos 6 caracteres."); return; }
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
        <div className="settings-tabs" role="tablist" aria-label="Configurações da conta">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "profile"}
            aria-controls="settings-profile-panel"
            className={`settings-tab ${tab === "profile" ? "active" : ""}`}
            onClick={() => { setTab("profile"); resetFeedback(); }}
          >
            👤 Perfil
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "password"}
            aria-controls="settings-password-panel"
            className={`settings-tab ${tab === "password" ? "active" : ""}`}
            onClick={() => { setTab("password"); resetFeedback(); }}
          >
            🔒 Senha
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "subscription"}
            aria-controls="settings-subscription-panel"
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
          <form id="settings-profile-panel" role="tabpanel" className="settings-form" onSubmit={handleProfileSave}>
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
          <form id="settings-password-panel" role="tabpanel" className="settings-form" onSubmit={handlePasswordSave}>
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
              <label htmlFor="s-new">Nova Senha <span className="label-hint">(mínimo 6 caracteres)</span></label>
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
          <div id="settings-subscription-panel" role="tabpanel" className="settings-subscription-info">
            <div className="account-commercial-status">
              <span>Status da conta</span>
              <strong>{commercialStatus}</strong>
              <p>
                {subscription.access.canAccessDashboard
                  ? "Seu acesso aos casamentos e fotos é permanente. Os créditos são necessários somente para ativar novos casamentos."
                  : "Escolha um plano ou pacote de créditos para liberar seu primeiro casamento e o painel."}
              </p>
              <dl className="subscription-details">
                <div><dt>Créditos disponíveis</dt><dd>{subscription.creditsAvailable}</dd></div>
                <div><dt>Compras avulsas concluídas</dt><dd>{subscription.completedPurchases}</dd></div>
                <div><dt>Acesso ao painel</dt><dd>{subscription.access.canAccessDashboard ? "Liberado" : "Aguardando contratação"}</dd></div>
              </dl>
            </div>
            <div className="subscription-plan-card">
              <div className="plan-icon">💳</div>
              <div>
                <strong>{subscription.plan ? subscription.plan.name : "Nenhum plano contratado"}</strong>
                {subscription.plan ? (
                  <>
                    <p>{subscription.plan.organizationName} · {planStatusLabels[subscription.plan.status] ?? subscription.plan.status}</p>
                    <dl className="subscription-details">
                      <div><dt>Status do plano</dt><dd>{planStatusLabels[subscription.plan.status] ?? subscription.plan.status}</dd></div>
                      <div><dt>Período</dt><dd>{formatDate(subscription.plan.startDate)} até {formatDate(subscription.plan.endDate)}</dd></div>
                      <div><dt>Duração</dt><dd>{subscription.plan.durationMonths} mês(es)</dd></div>
                      <div><dt>Créditos por mês</dt><dd>{subscription.plan.creditsPerMonth}</dd></div>
                      <div><dt>Créditos disponíveis</dt><dd>{subscription.creditsAvailable}</dd></div>
                      <div><dt>Próxima liberação</dt><dd>{formatDate(subscription.plan.nextCreditReleaseAt)}</dd></div>
                    </dl>
                  </>
                ) : (
                  <p>Você pode contratar uma assinatura ou usar somente créditos avulsos.</p>
                )}
              </div>
            </div>
            <Link href="/planos?notice=manage_plan" className="settings-plan-action">
              {subscription.access.hasActivePlan ? "Comparar e alterar plano" : "Ver planos e comprar créditos"} →
            </Link>
          </div>
        )}

        {/* Voltar */}
        <div className="settings-back">
          <Link href={subscription.access.canAccessDashboard ? "/app" : "/planos"} className="link-back-home">
            ← {subscription.access.canAccessDashboard ? "Voltar ao Painel" : "Voltar aos Planos"}
          </Link>
          <form action="/api/admin/auth/logout" method="post">
            <button type="submit" className="logout-button">Sair da conta</button>
          </form>
        </div>
      </div>
    </div>
  );
}
