import Link from "next/link";
import { redirect } from "next/navigation";
import { DEMO_ADMIN_EMAIL, getCurrentAdminSession } from "@/server/auth/admin-auth.service";
import { getDemoAdminPassword } from "@/server/config/runtime";

export const metadata = {
  title: "Acesso da Cerimonialista | SiteCasamento",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  // Uma sessão válida nunca volta a exibir o formulário de login.
  const user = await getCurrentAdminSession();
  if (user) {
    redirect("/app");
  }

  const params = await searchParams;
  const errorMessage = params.error ?? "";
  const notice = params.notice ?? "";
  const demoPassword = process.env.NODE_ENV === "production" ? null : getDemoAdminPassword();

  return (
    <main className="admin-login-layout">
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-header">
            <Link href="/" className="login-brand">
              <span className="brand-icon">💍</span>
              <span className="brand-name">SiteCasamento</span>
            </Link>
            <h1>Bom ter você de volta.</h1>
            <p>Entre para cuidar dos seus casamentos, acompanhar as missões e reunir as fotos.</p>
          </div>

          {notice === "subscription_required" && (
            <div className="notice-info-banner">
              Para acessar o painel, você precisa de um plano ativo. <Link href="/planos">Conhecer os planos</Link>.
            </div>
          )}

          {errorMessage && (
            <div className="form-error-banner" role="alert">{errorMessage}</div>
          )}

          <form action="/api/admin/auth/login" method="post" className="login-form">
            <div className="login-field">
              <label htmlFor="email">Seu e-mail</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                inputMode="email"
                placeholder="seu.email@exemplo.com"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Sua senha</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••••••"
                required
              />
            </div>
            <button type="submit" className="btn-login-submit">
              Acessar meu painel →
            </button>
          </form>

          {demoPassword ? (
            <aside className="demo-credentials-box" aria-label="Acesso local de demonstração">
              <span className="demo-tag">CONTA TESTE · CRÉDITOS ILIMITADOS</span>
              <p><strong>E-mail:</strong> <code>{DEMO_ADMIN_EMAIL}</code></p>
              <p><strong>Senha:</strong> <code>{demoPassword}</code></p>
              <small>Disponível somente no ambiente local — a cerimonialista que tem todos os créditos do mundo 😄</small>
            </aside>
          ) : null}

          <div className="login-card-footer">
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#6d4e52" }}>
              Não tem conta?{" "}
              <Link href="/app/cadastro" style={{ color: "#a95954", fontWeight: 750 }}>
                Criar conta gratuita
              </Link>
            </p>
            <Link href="/" className="link-back-home">
              ← Voltar para a Página Inicial
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
