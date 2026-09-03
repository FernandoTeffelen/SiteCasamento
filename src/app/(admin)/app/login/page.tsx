import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentAdminSession, checkUserIsPayingOrActive } from "@/server/auth/admin-auth.service";

export const metadata = {
  title: "Acesso da Cerimonialista | SiteCasamento",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  // Se já está logada e pagante, vai direto para o admin
  const user = await getCurrentAdminSession();
  if (user) {
    const isPaying = await checkUserIsPayingOrActive(user.id);
    if (isPaying) redirect("/app");
  }

  const params = await searchParams;
  const errorMessage = params.error ?? "";
  const notice = params.notice ?? "";

  return (
    <div className="admin-login-layout">
      <div className="login-card-container">
        <div className="login-card">
          <div className="login-card-header">
            <Link href="/" className="login-brand">
              <span className="brand-icon">💍</span>
              <span className="brand-name">SiteCasamento</span>
            </Link>
            <h1>Painel da Cerimonialista</h1>
            <p>Acesse sua conta para gerenciar casamentos, missões e fotos em tempo real.</p>
          </div>

          {notice === "subscription_required" && (
            <div className="notice-info-banner">
              Para acessar o painel, você precisa de um plano ativo. Escolha um plano abaixo.
            </div>
          )}

          {errorMessage && (
            <div className="form-error-banner">{decodeURIComponent(errorMessage)}</div>
          )}

          <form action="/api/admin/auth/login" method="post" className="login-form">
            <div className="login-field">
              <label htmlFor="email">E-mail Profissional</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="seu.email@exemplo.com"
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="password">Senha de Acesso</label>
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
              Entrar no Painel ➔
            </button>
          </form>

          <div className="demo-credentials-box">
            <span className="demo-tag">ℹ️ Credenciais Demo para Testes:</span>
            <p><strong>E-mail:</strong> <code>cerimonial@demo.test</code></p>
            <p><strong>Senha:</strong> <code>cerimonial1234</code></p>
          </div>

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
    </div>
  );
}
