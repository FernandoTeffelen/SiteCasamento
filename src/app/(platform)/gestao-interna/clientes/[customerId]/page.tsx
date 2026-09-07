import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountStatus, ManualAccessPlanStatus } from "@/generated/prisma/client";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { isDomainError } from "@/server/domain/error";
import { getPlatformCustomerDetails } from "@/server/platform/platform-dashboard.service";
import { DeleteCustomerButton } from "../delete-customer-button";
import { ManualPlanForm } from "./manual-plan-form";

export const metadata = {
  title: "Detalhes do cliente | Gestão interna",
  robots: { index: false, follow: false },
};

const typeLabel = { CEREMONIALIST: "Cerimonialista", COUPLE: "Casal" };
const planStatusLabel = { PENDING_PAYMENT: "Aguardando pagamento", ACTIVE: "Ativo", EXPIRED: "Expirado", CANCELED: "Cancelado" };
const creditMovementLabel = { ADJUSTMENT: "Liberação manual", ONE_TIME_PURCHASE: "Compra avulsa", SUBSCRIPTION_CYCLE: "Ciclo de assinatura", WEDDING_ACTIVATION: "Casamento ativado", REFUND: "Estorno" };

function formatOptionalDate(date: Date | null) {
  return date ? date.toLocaleDateString("pt-BR") : "—";
}

export default async function PlatformCustomerDetailsPage({ params }: { params: Promise<{ customerId: string }> }) {
  let user: Awaited<ReturnType<typeof requirePlatformAdministrator>>;
  try {
    user = await requirePlatformAdministrator();
  } catch (error) {
    if (isDomainError(error)) redirect("/gestao-interna/login");
    throw error;
  }
  const { customerId } = await params;
  let data: Awaited<ReturnType<typeof getPlatformCustomerDetails>>;
  try {
    data = await getPlatformCustomerDetails({ userId: user.id, customerId });
  } catch (error) {
    if (isDomainError(error) && error.code === "CUSTOMER_NOT_FOUND") redirect("/gestao-interna/clientes");
    throw error;
  }

  const { customer } = data;
  const isSuspended = customer.accountStatus === AccountStatus.SUSPENDED;
  const manualPlans = data.organizations.flatMap((organization) => organization.manualAccessPlans.map((plan) => ({ ...plan, organizationName: organization.name })));

  return (
    <main className="platform-dashboard-layout platform-customer-detail-page">
      <header className="platform-customer-detail-hero">
        <div>
          <Link href="/gestao-interna/clientes" className="platform-back-link">← Clientes</Link>
          <span className="platform-eyebrow">CONTA DO CLIENTE</span>
          <h1>{customer.name ?? "Sem nome"}</h1>
          <p>{customer.email}</p>
        </div>
        <form action="/api/platform/auth/logout" method="post"><button type="submit">Sair</button></form>
      </header>

      <section className="platform-detail-section platform-detail-overview" aria-labelledby="overview-title">
        <div className="platform-detail-section-heading"><span className="platform-eyebrow">RESUMO</span><h2 id="overview-title">Visão da conta</h2></div>
        <div className="platform-detail-overview-grid">
          <article><span>Perfil</span><strong>{typeLabel[customer.customerType]}</strong></article>
          <article><span>Status</span><strong className={`platform-account-status ${customer.accountStatus.toLowerCase()}`}>{isSuspended ? "Suspensa" : "Ativa"}</strong></article>
          <article><span>Créditos disponíveis</span><strong className="platform-detail-highlight">{customer.creditsAvailable}</strong></article>
          <article><span>Cliente desde</span><strong>{customer.createdAt.toLocaleDateString("pt-BR")}</strong></article>
        </div>
      </section>

      <section className="platform-detail-section platform-detail-credit-cycle" aria-labelledby="credit-summary-title">
        <div className="platform-detail-section-heading"><span className="platform-eyebrow">CRÉDITOS</span><h2 id="credit-summary-title">Saldo e ciclos</h2><p>Resumo dos créditos liberados, usados e das próximas liberações.</p></div>
        <div className="platform-detail-credit-cycle-grid">
          <article><span>Recebidos</span><strong>{data.creditSummary.received}</strong></article>
          <article><span>Utilizados</span><strong>{data.creditSummary.used}</strong></article>
          <article><span>Disponíveis</span><strong className="platform-detail-highlight">{data.creditSummary.available}</strong></article>
          <article><span>Última liberação</span><strong>{formatOptionalDate(data.creditSummary.lastCreditReleasedAt)}</strong></article>
          <article><span>Próxima liberação</span><strong>{formatOptionalDate(data.creditSummary.nextCreditReleaseAt)}</strong></article>
        </div>
      </section>

      <div className="platform-detail-workspace">
        <div className="platform-detail-primary-column">
          <section className="platform-detail-section platform-detail-access" aria-labelledby="access-title">
            <div className="platform-detail-section-heading"><span className="platform-eyebrow">LIBERAR ACESSO</span><h2 id="access-title">Créditos e plano</h2><p>Escolha abaixo a ação que deseja realizar para este cliente.</p></div>
            <ManualPlanForm customerId={customer.id} organizations={data.organizations.map((organization) => ({ id: organization.id, name: organization.name }))} />
          </section>

          <section className="platform-detail-section platform-detail-history" aria-labelledby="manual-plan-history-title">
            <div className="platform-detail-section-heading"><span className="platform-eyebrow">HISTÓRICO DE PLANO</span><h2 id="manual-plan-history-title">Liberações registradas</h2></div>
            {manualPlans.length ? <div className="platform-plan-history-list">{manualPlans.map((plan) => (
              <article key={plan.id}>
                <div><strong>{plan.organizationName}</strong><span>{plan.durationMonths} mês(es) · {plan.creditsPerMonth} crédito(s)/mês</span><small>{plan.startDate.toLocaleDateString("pt-BR")} até {plan.endDate.toLocaleDateString("pt-BR")}</small></div>
                <div className="platform-plan-history-actions"><span className={`platform-plan-status ${plan.status.toLowerCase()}`}>{planStatusLabel[plan.status]}</span>{plan.status === ManualAccessPlanStatus.PENDING_PAYMENT ? <form action={`/api/platform/customers/${customer.id}/manual-plans/${plan.id}/status`} method="post"><input type="hidden" name="status" value={ManualAccessPlanStatus.ACTIVE} /><button type="submit">Confirmar PIX</button></form> : null}{plan.status === ManualAccessPlanStatus.ACTIVE ? <form action={`/api/platform/customers/${customer.id}/manual-plans/${plan.id}/status`} method="post"><input type="hidden" name="status" value={ManualAccessPlanStatus.CANCELED} /><button type="submit">Cancelar</button></form> : null}</div>
              </article>
            ))}</div> : <div className="platform-detail-empty">Ainda não há liberações mensais registradas.</div>}
          </section>
        </div>

        <aside className="platform-detail-side-column">
          <section className="platform-detail-section platform-detail-organizations" aria-labelledby="customer-organizations-title">
            <div className="platform-detail-section-heading"><span className="platform-eyebrow">ORGANIZAÇÕES</span><h2 id="customer-organizations-title">Conta vinculada</h2></div>
            {data.organizations.map((organization) => <article key={organization.id}><strong>{organization.name}</strong><span>{organization._count.weddings} casamento(s) · {organization.creditBalance?.balance ?? 0} créditos</span><small>{organization.subscriptions[0] ? `${organization.subscriptions[0].tier} · ${organization.subscriptions[0].period}` : "Sem assinatura automática"}</small></article>)}
          </section>

          <section className="platform-detail-section platform-detail-danger">
            <div className="platform-detail-section-heading"><span className="platform-eyebrow">GERENCIAMENTO</span><h2>{isSuspended ? "Reativar conta" : "Suspender conta"}</h2><p>{isSuspended ? "A conta voltará a acessar o painel." : "Encerra as sessões do cliente e bloqueia novos acessos."}</p></div>
            <form action={`/api/platform/customers/${customer.id}/status`} method="post"><input type="hidden" name="accountStatus" value={isSuspended ? AccountStatus.ACTIVE : AccountStatus.SUSPENDED} /><button type="submit" className={isSuspended ? "platform-reactivate-button" : "platform-suspend-button"}>{isSuspended ? "Reativar conta" : "Suspender conta"}</button></form>
            <DeleteCustomerButton customerId={customer.id} customerName={customer.name ?? customer.email} />
          </section>
        </aside>
      </div>

      <section className="platform-detail-section platform-detail-credit-history" aria-labelledby="credit-history-title">
        <div className="platform-detail-section-heading"><span className="platform-eyebrow">MOVIMENTAÇÕES</span><h2 id="credit-history-title">Histórico de créditos</h2></div>
        {data.creditMovements.length ? <div className="platform-credit-history-list">{data.creditMovements.map((movement) => <article key={movement.id}><div><strong>{movement.description ?? creditMovementLabel[movement.type]}</strong><span>{movement.organization.name} · {movement.createdAt.toLocaleString("pt-BR")}</span></div><div><strong className={movement.delta > 0 ? "credit-in" : "credit-out"}>{movement.delta > 0 ? "+" : ""}{movement.delta}</strong><span>Saldo após: {movement.balanceAfter}</span></div></article>)}</div> : <div className="platform-detail-empty">Nenhuma movimentação de crédito registrada.</div>}
      </section>
    </main>
  );
}
