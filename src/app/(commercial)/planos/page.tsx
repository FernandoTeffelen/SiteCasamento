import Link from "next/link";
import { getPublicCommercialCatalog } from "@/server/billing/commercial-catalog.service";
import { PlansConfigurator } from "./plans-configurator";
import { getCurrentAdminSession } from "@/server/auth/admin-auth.service";
import { getAdminDashboardAccess } from "@/server/auth/admin-auth.service";
import { PublicAccountActions } from "@/features/account/PublicAccountActions";
import { isMercadoPagoConfigured } from "@/server/payments/mercado-pago.config";

export const metadata = {
  title: "Planos & Créditos | SiteCasamento",
  description: "Planos de assinatura e pacotes de créditos avulsos para cerimonialistas.",
};

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [params, catalog, session] = await Promise.all([
    searchParams,
    getPublicCommercialCatalog(),
    getCurrentAdminSession(),
  ]);
  const access = session ? await getAdminDashboardAccess(session.id) : null;
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
            <PublicAccountActions user={session} access={access} />
          </div>
        </div>
      </header>

      <main className="plans-page-container">
        {notice === "subscription_required" && !access?.canAccessDashboard && (
          <div className="notice-info-banner plans-notice">
            <strong>Sua sessão está ativa.</strong> Escolha um plano ou créditos para liberar seu primeiro casamento e o acesso permanente ao painel.
          </div>
        )}
        {notice === "new_account" && (
          <div className="notice-success-banner plans-notice">
            <strong>Conta criada com sucesso!</strong> Escolha um plano para começar a criar casamentos e experiências fotográficas.
          </div>
        )}
        {notice === "manage_plan" && (
          <div className="notice-info-banner plans-notice">
            <strong>Planos e créditos:</strong> compare as opções abaixo para alterar seu plano ou adicionar novos créditos. Nenhuma mudança é feita sem sua confirmação.
          </div>
        )}

        <section className="plans-header">
          <span className="section-tag">INVESTIMENTO TRANSPARENTE</span>
          <h1>Escolha o melhor plano para seus eventos</h1>
          <p>Monte sua assinatura em poucos passos ou veja as opções de créditos avulsos.</p>
        </section>

        <PlansConfigurator
          catalog={catalog}
          canRecordCommercialAcceptance={Boolean(session)}
          paymentConfigured={isMercadoPagoConfigured()}
        />

        <div className="plans-back-action">
          <Link href="/" className="btn-back-home">← Voltar para a Página Inicial</Link>
        </div>
        <nav className="plans-legal-links" aria-label="Documentos jurídicos">
          <Link href="/privacidade">Política de Privacidade</Link>
          <Link href="/termos-de-uso">Termos de Uso</Link>
          <Link href="/termo-comercial">Termo Comercial</Link>
        </nav>
      </main>
    </div>
  );
}
