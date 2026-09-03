import Link from "next/link";

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
      {/* Navbar */}
      <header className="commercial-navbar">
        <div className="navbar-container">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">💍</span>
            <span className="brand-text">SiteCasamento</span>
          </Link>
          <nav className="navbar-links">
            <Link href="/">Início</Link>
            <Link href="/planos" className="active">Planos & Preços</Link>
          </nav>
          <div className="navbar-cta">
            <Link href="/app/login" className="btn-login-nav">Entrar no Painel ➔</Link>
          </div>
        </div>
      </header>

      <main className="plans-page-container">
        {/* Avisos contextuais */}
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
          <p>Assinaturas mensais ou anuais com créditos recorrentes, além de pacotes de créditos avulsos sob demanda.</p>
        </section>

        {/* Grid de Planos */}
        <section className="pricing-grid">
          <div className="pricing-card">
            <div className="pricing-card-top">
              <span className="tier-badge">Iniciante</span>
              <h3>Starter</h3>
              <p className="tier-desc">Ideal para profissionais começando a oferecer a experiência.</p>
              <div className="pricing-credits-highlight"><strong>3 créditos</strong> / mês</div>
              <span className="credit-subtext">(1 crédito = 1 casamento ativo)</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Até 3 casamentos por mês</li>
              <li>✓ QR Codes individuais por evento</li>
              <li>✓ Missões fotográficas padrão</li>
              <li>✓ Ranking em tempo real</li>
              <li>✓ Fila offline tolerante a falhas</li>
              <li>✓ Painel da cerimonialista</li>
            </ul>
            <span className="btn-plan-unavailable">Em breve — Pagamento não disponível</span>
          </div>

          <div className="pricing-card pricing-card-featured">
            <div className="featured-ribbon">Mais Escolhido</div>
            <div className="pricing-card-top">
              <span className="tier-badge featured-badge">Em Crescimento</span>
              <h3>Pro</h3>
              <p className="tier-desc">Para cerimonialistas com agenda ativa de casamentos.</p>
              <div className="pricing-credits-highlight"><strong>6 créditos</strong> / mês</div>
              <span className="credit-subtext">(1 crédito = 1 casamento ativo)</span>
            </div>
            <ul className="pricing-features">
              <li>✓ Até 6 casamentos por mês</li>
              <li>✓ QR Codes e tokens seguros</li>
              <li>✓ Suporte prioritário</li>
              <li>✓ Ranking e fotos em tempo real</li>
              <li>✓ Templates visuais personalizáveis</li>
              <li>✓ Download do álbum completo</li>
            </ul>
            <span className="btn-plan-unavailable">Em breve — Pagamento não disponível</span>
          </div>

          <div className="pricing-card">
            <div className="pricing-card-top">
              <span className="tier-badge">Grande Volume</span>
              <h3>Agency</h3>
              <p className="tier-desc">Para assessorias completas e produtoras de eventos.</p>
              <div className="pricing-credits-highlight"><strong>10+ créditos</strong> / mês</div>
              <span className="credit-subtext">(1 crédito = 1 casamento ativo)</span>
            </div>
            <ul className="pricing-features">
              <li>✓ 10 ou mais casamentos por mês</li>
              <li>✓ Opção White Label</li>
              <li>✓ Maior capacidade de armazenamento</li>
              <li>✓ Estatísticas avançadas</li>
              <li>✓ Suporte VIP dedicado</li>
            </ul>
            <span className="btn-plan-unavailable">Em breve — Pagamento não disponível</span>
          </div>
        </section>

        {/* Créditos Avulsos */}
        <section className="credit-packages-section">
          <div className="credit-packages-card">
            <div className="packages-text">
              <h2>Prefere créditos avulsos sem mensalidade?</h2>
              <p>Compre apenas o que precisar para casamentos pontuais ou demandas sazonais.</p>
              <span className="btn-plan-unavailable" style={{ display: "inline-block", marginTop: "1rem" }}>
                Em breve — Pagamento não disponível
              </span>
            </div>
            <div className="packages-options">
              <div className="package-pill"><strong>1 Casamento</strong><span>Uso único</span></div>
              <div className="package-pill"><strong>5 Casamentos</strong><span>Desconto moderado</span></div>
              <div className="package-pill"><strong>10 Casamentos</strong><span>Melhor custo/evento</span></div>
            </div>
          </div>
        </section>

        <div className="plans-back-action">
          <Link href="/" className="btn-back-home">← Voltar para a Página Inicial</Link>
        </div>
      </main>
    </div>
  );
}
