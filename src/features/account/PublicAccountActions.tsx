import Link from "next/link";
import type { AdminDashboardAccess } from "@/server/auth/admin-auth.service";

type PublicAccountUser = {
  name: string | null;
  email: string;
};

function getAccountStatusLabel(access: AdminDashboardAccess) {
  if (access.hasActivePlan) return "Plano ativo";
  if (access.creditsAvailable > 0) {
    return `${access.creditsAvailable} crédito${access.creditsAvailable === 1 ? "" : "s"}`;
  }
  if (access.hasCommercialHistory) return "Acesso permanente";
  return "Plano pendente";
}

export function PublicAccountActions({
  user,
  access,
  loginClassName = "btn-login-nav",
}: {
  user: PublicAccountUser | null;
  access: AdminDashboardAccess | null;
  loginClassName?: string;
}) {
  if (!user || !access) {
    return <Link href="/app/login" className={loginClassName}>Entrar no painel <span aria-hidden="true">↗</span></Link>;
  }

  const displayName = user.name?.trim() || user.email;
  const dashboardHref = access.canAccessDashboard ? "/app" : "/planos";

  return (
    <div className="public-account-actions">
      <Link href="/app/configuracoes" className="public-account-profile" title="Abrir perfil e configurações">
        <span className="public-account-avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
        <span className="public-account-copy">
          <strong>{displayName}</strong>
          <small>{getAccountStatusLabel(access)}</small>
        </span>
      </Link>
      <Link href={dashboardHref} className={loginClassName}>
        {access.canAccessDashboard ? "Abrir painel" : "Ver planos"} <span aria-hidden="true">→</span>
      </Link>
      <form action="/api/admin/auth/logout" method="post" className="public-account-logout-form">
        <button type="submit" className="public-account-logout">Sair</button>
      </form>
    </div>
  );
}
