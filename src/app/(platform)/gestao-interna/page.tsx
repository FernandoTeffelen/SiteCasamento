import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { isDomainError } from "@/server/domain/error";
import { getPlatformDashboardData } from "@/server/platform/platform-dashboard.service";

export const metadata = {
  title: "Gestão interna | SiteCasamento",
  robots: { index: false, follow: false },
};

export default async function PlatformDashboardPage() {
  let user: Awaited<ReturnType<typeof requirePlatformAdministrator>>;
  try {
    user = await requirePlatformAdministrator();
  } catch (error) {
    if (isDomainError(error)) redirect("/gestao-interna/login");
    throw error;
  }

  const data = await getPlatformDashboardData(user.id);
  const metrics = [
    { label: "Clientes", value: data.metrics.users, detail: "contas cadastradas", tone: "violet", mark: "01" },
    { label: "Organizações", value: data.metrics.organizations, detail: "espaços de trabalho", tone: "blue", mark: "02" },
    { label: "Casamentos", value: data.metrics.weddings, detail: "eventos criados", tone: "coral", mark: "03" },
    { label: "Fotos", value: data.metrics.photos, detail: "memórias recebidas", tone: "gold", mark: "04" },
  ];
  const hasCustomers = data.metrics.users > 0;
  const activeWeddings = data.weddingStatusCounts.ACTIVE;

  return (
    <main className="platform-dashboard-layout">
      <section className="platform-overview-hero" aria-labelledby="platform-overview-title">
        <div className="platform-overview-glow" aria-hidden="true" />
        <div className="platform-overview-hero-top">
          <div className="platform-overview-brand">
            <span className="platform-overview-logo">SC</span>
            <span>SiteCasamento <small>· operação interna</small></span>
          </div>
          <form action="/api/platform/auth/logout" method="post">
            <button type="submit" className="platform-sign-out">Sair</button>
          </form>
        </div>

        <div className="platform-overview-copy">
          <span className="platform-overview-eyebrow">PAINEL DO PROPRIETÁRIO</span>
          <h1 id="platform-overview-title">Controle simples.<br/><em>Visão completa.</em></h1>
        </div>

        <div className="platform-overview-actions">
          <Link href="/gestao-interna/clientes" className="platform-primary-action">
            <span>Gerenciar clientes</span><b aria-hidden="true">→</b>
          </Link>
          <span className="platform-overview-note">
            <i aria-hidden="true" /> {hasCustomers ? `${data.metrics.users} cliente(s) para acompanhar` : "Pronto para receber o primeiro cadastro"}
          </span>
        </div>
      </section>

      <section className="platform-overview-section" aria-labelledby="platform-metrics-title">
        <div className="platform-overview-section-heading">
          <div>
            <span>VISÃO GERAL</span>
            <h2 id="platform-metrics-title">O que está acontecendo</h2>
          </div>
          <p>Atualizado em tempo real conforme novas contas e eventos são criados.</p>
        </div>

        <div className="platform-metrics" aria-label="Indicadores da plataforma">
          {metrics.map((metric) => (
            <article key={metric.label} className={`platform-metric-card ${metric.tone}`}>
              <span className="platform-metric-mark">{metric.mark}</span>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="platform-overview-grid">
        <section className="platform-status-card platform-overview-status" aria-labelledby="wedding-status-title">
          <div className="platform-overview-card-heading">
            <div>
              <span>CASAMENTOS</span>
              <h2 id="wedding-status-title">Saúde dos eventos</h2>
            </div>
            <strong className={activeWeddings > 0 ? "platform-live-indicator" : "platform-idle-indicator"}>
              <i aria-hidden="true" /> {activeWeddings > 0 ? "Em andamento" : "Aguardando"}
            </strong>
          </div>
          <dl>
            <div><dt>Ativos</dt><dd>{data.weddingStatusCounts.ACTIVE}</dd></div>
            <div><dt>Rascunhos</dt><dd>{data.weddingStatusCounts.DRAFT}</dd></div>
            <div><dt>Encerrados</dt><dd>{data.weddingStatusCounts.CLOSED}</dd></div>
            <div><dt>Arquivados</dt><dd>{data.weddingStatusCounts.ARCHIVED}</dd></div>
          </dl>
        </section>

        <aside className="platform-next-step" aria-labelledby="platform-next-step-title">
          <span className="platform-next-step-number">PRÓXIMO PASSO</span>
          <h2 id="platform-next-step-title">{hasCustomers ? "Revise os acessos dos clientes" : "Crie uma conta de teste"}</h2>
          <p>{hasCustomers ? "Abra os detalhes de cada cliente para liberar meses de acesso e créditos mensais." : "Assim que uma cerimonialista ou casal se cadastrar, a conta aparecerá automaticamente aqui."}</p>
          <Link href="/gestao-interna/clientes">Abrir clientes <span aria-hidden="true">→</span></Link>
        </aside>
      </section>
    </main>
  );
}
