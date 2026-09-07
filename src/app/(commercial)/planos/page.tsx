import Link from "next/link";
import { PlansConfigurator } from "./plans-configurator";

export const metadata = {
  title: "Planos & Créditos | SiteCasamento",
  description: "Planos de assinatura e pacotes de créditos avulsos para cerimonialistas.",
};

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const params = await searchParams;
  const notice = params.notice ?? "";

  return (
    <div className="commercial-layout">
      <header className="commercial-navbar">
        <div className="navbar-container">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">💍</span>
            <span className="brand-text">SiteCasamento</span>
          </Link>
          <nav className="navbar-links">
            <Link href="/">Início</Link>
            <Link href="/planos" className="active">Planos &amp; Preços</Link>
          </nav>
          <div className="navbar-cta">
            <Link href="/app/login" className="btn-login-nav">Entrar no Painel ➜</Link>
          </div>
        </div>
      </header>

      <main className="plans-page-container">
        {notice === "subscription_required" && (
          <div className="notice-info-banner plans-notice">
            <strong>Plano necessário:</strong> Para acessar o painel da cerimonialista, escolha um plano abaixo.
            Após o pagamento, você será redirecionada automaticamente.
          </div>
        )}
        {notice === "new_account" && (
          <div className="notice-success-banner plans-notice">
            <strong>Conta criada com sucesso!</strong> Escolha um plano para começar a criar casamentos e experiências fotográficas.
          </div>
        )}

        <section className="plans-header">
          <span className="section-tag">INVESTIMENTO TRANSPARENTE</span>
          <h1>Escolha o melhor plano para seus eventos</h1>
          <p>Monte sua assinatura em poucos passos ou veja as opções de créditos avulsos.</p>
        </section>

        <PlansConfigurator />

        <div className="plans-back-action">
          <Link href="/" className="btn-back-home">← Voltar para a Página Inicial</Link>
        </div>
      </main>
    </div>
  );
}
