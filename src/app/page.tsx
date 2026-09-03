import Link from "next/link";

export const metadata = {
  title: "SiteCasamento | A Plataforma de Gamificação Fotográfica para Casamentos",
  description: "Crie experiências interativas com missões fotográficas e QR Code para casamentos. SaaS B2B para cerimonialistas.",
};

export default function HomePage() {
  return (
    <div className="commercial-layout">
      {/* Navbar Desktop */}
      <header className="commercial-navbar">
        <div className="navbar-container">
          <Link href="/" className="brand-logo">
            <span className="brand-icon">💍</span>
            <span className="brand-text">SiteCasamento</span>
          </Link>

          <nav className="navbar-links">
            <a href="#como-funciona">Como Funciona</a>
            <a href="#recursos">Recursos</a>
            <Link href="/planos">Planos & Preços</Link>
          </nav>

          <div className="navbar-cta">
            <Link href="/app/login" className="btn-login-nav">
              Acessar Painel da Cerimonialista ➔
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-container">
          <div className="hero-badge">
            <span className="badge-sparkle">✨</span> Plataforma SaaS para Cerimonialistas & Eventos
          </div>
          <h1 className="hero-title">
            Experiências interativas de casamento que cabem em um <span>QR Code</span>.
          </h1>
          <p className="hero-subtitle">
            Engaje os convidados com missões fotográficas divertidas, pontuação e ranking em tempo real — sem necessidade de instalar aplicativos.
          </p>

          <div className="hero-actions">
            <Link href="/planos" className="btn-hero-primary">
              Conhecer Planos e Créditos
            </Link>
            <Link href="/app/login" className="btn-hero-secondary">
              Entrar no Painel Administrativo
            </Link>
          </div>

          <div className="hero-highlight-chips">
            <span>✓ Funciona direto no Safari e Android</span>
            <span>✓ Fila com tolerância a internet ruim</span>
            <span>✓ Privacidade total por token seguro</span>
          </div>
        </div>
      </section>

      {/* Seção Como Funciona */}
      <section id="como-funciona" className="how-it-works-section">
        <div className="section-container">
          <div className="section-header-center">
            <span className="section-tag">SIMPLICIDADE MÁXIMA</span>
            <h2>Como Funciona a Experiência</h2>
            <p>Do QR Code na mesa ao álbum completo no painel da cerimonialista.</p>
          </div>

          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <h3>Criação no Painel</h3>
              <p>A cerimonialista cadastra o casamento, escolhe missões personalizadas e gera o link com token seguro e QR Code.</p>
            </div>

            <div className="step-card">
              <div className="step-number">2</div>
              <h3>Participação no Celular</h3>
              <p>O convidado aponta a câmera, digita seu nome e já pode cumprir os desafios fotográficos na hora.</p>
            </div>

            <div className="step-card">
              <div className="step-number">3</div>
              <h3>Fotos e Ranking ao Vivo</h3>
              <p>As fotos são sincronizadas com o painel em tempo real, os pontos são calculados e o ranking é disputado.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Seção Recursos & Diferenciais */}
      <section id="recursos" className="features-section">
        <div className="section-container">
          <div className="section-header-center">
            <span className="section-tag">TECNOLOGIA ROBUSTA</span>
            <h2>Projetado para o Sucesso do Evento</h2>
            <p>Confiabilidade máxima mesmo em locais com sinal de internet instável.</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">📱</div>
              <h3>Zero Instalação de App</h3>
              <p>Acesso instantâneo via navegador no iPhone (Safari) e Android (Chrome). Nenhum convidado precisa baixar nada na App Store.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📶</div>
              <h3>Fila Offline Inteligente</h3>
              <p>Se a internet da festa oscilar, as fotos ficam seguras na fila local do aparelho (IndexedDB) e são reenviadas automaticamente.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🏆</div>
              <h3>Gamificação & Ranking</h3>
              <p>Pontuação calculada com integridade no servidor, evitando fraudes e estimulando a participação animada dos convidados.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3>Tokens Privados e Seguros</h3>
              <p>Cada casamento é totalmente isolado por tokens não enumeráveis. Apenas quem tem o link/QR Code pode participar.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">📸</div>
              <h3>Preservação da Qualidade</h3>
              <p>Armazenamento em nuvem de alta capacidade, permitindo que os noivos tenham acesso às fotos originais do grande dia.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">💼</div>
              <h3>Painel da Cerimonialista</h3>
              <p>Gestão centralizada de múltiplos casamentos, controle de créditos, acompanhamento de fotos em tempo real e relatórios.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="cta-banner-section">
        <div className="cta-container">
          <h2>Pronta para encantar noivos e convidados?</h2>
          <p>Conheça nossos planos flexíveis para cerimonialistas ou compre créditos avulsos.</p>
          <div className="cta-buttons">
            <Link href="/planos" className="btn-cta-white">
              Ver Tabela de Planos
            </Link>
            <Link href="/app/login" className="btn-cta-outline">
              Entrar no Painel
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="commercial-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <strong>💍 SiteCasamento</strong>
            <p>Plataforma de experiências interativas para casamentos.</p>
          </div>
          <div className="footer-links">
            <Link href="/planos">Planos & Preços</Link>
            <Link href="/app/login">Área da Cerimonialista</Link>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} SiteCasamento. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
