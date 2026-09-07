import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePlatformAdministrator } from "@/server/auth/admin-auth.service";
import { isDomainError } from "@/server/domain/error";
import { getPlatformCustomers } from "@/server/platform/platform-dashboard.service";
import { DeleteCustomerButton } from "./delete-customer-button";

export const metadata = {
  title: "Clientes | Gestão interna",
  robots: { index: false, follow: false },
};

const typeLabel = { CEREMONIALIST: "Cerimonialista", COUPLE: "Casal" };
const statusLabel = { ACTIVE: "Ativa", SUSPENDED: "Suspensa" };

function initials(name: string | null, email: string) {
  const words = (name ?? email).trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function customerUrl(search: string, page: number) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/gestao-interna/clientes?${query}` : "/gestao-interna/clientes";
}

export default async function PlatformCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  let user: Awaited<ReturnType<typeof requirePlatformAdministrator>>;
  try {
    user = await requirePlatformAdministrator();
  } catch (error) {
    if (isDomainError(error)) redirect("/gestao-interna/login");
    throw error;
  }
  const params = await searchParams;
  const data = await getPlatformCustomers({ userId: user.id, search: params.q, page: params.page });

  return (
    <main className="platform-dashboard-layout platform-customers-page">
      <header className="platform-customers-hero">
        <div className="platform-customers-hero-copy">
          <Link href="/gestao-interna" className="platform-back-link">← Visão geral</Link>
          <span className="platform-eyebrow">OPERAÇÃO INTERNA</span>
          <h1>Clientes</h1>
          <p>Encontre uma conta, acompanhe os créditos e gerencie acessos em um só lugar.</p>
        </div>
        <div className="platform-customers-hero-actions">
          <div className="platform-customer-count"><strong>{data.pagination.total}</strong><span>conta{data.pagination.total === 1 ? "" : "s"} cadastrada{data.pagination.total === 1 ? "" : "s"}</span></div>
          <form action="/api/platform/auth/logout" method="post"><button type="submit">Sair</button></form>
        </div>
      </header>

      <section className="platform-customer-toolbar" aria-labelledby="customer-directory-title">
        <div>
          <span className="platform-eyebrow">DIRETÓRIO DE CLIENTES</span>
          <h2 id="customer-directory-title">Contas cadastradas</h2>
          <p>Use a busca para localizar rapidamente por nome ou e-mail.</p>
        </div>
        <form className="platform-customer-search" method="get">
          <label htmlFor="customer-search">Pesquisar cliente</label>
          <div>
            <input id="customer-search" name="q" defaultValue={data.search} placeholder="Nome ou e-mail" />
            <button type="submit">Buscar</button>
          </div>
        </form>
      </section>

      <section className="platform-customer-directory" aria-label="Lista de clientes">
        <div className="platform-customer-directory-heading">
          <p>{data.search ? `Resultados para “${data.search}”` : "Todos os clientes"}</p>
          <span>{data.pagination.total} encontrado{data.pagination.total === 1 ? "" : "s"}</span>
        </div>
        {data.customers.length ? (
          <div className="platform-customer-card-grid">
            {data.customers.map((customer) => (
              <article className="platform-customer-card" key={customer.id}>
                <div className="platform-customer-card-head">
                  <div className="platform-customer-avatar" aria-hidden="true">{initials(customer.name, customer.email)}</div>
                  <div>
                    <h3>{customer.name ?? "Sem nome"}</h3>
                    <p>{customer.email}</p>
                  </div>
                  <span className={`platform-account-status ${customer.accountStatus.toLowerCase()}`}>{statusLabel[customer.accountStatus]}</span>
                </div>
                <dl className="platform-customer-card-metrics">
                  <div><dt>Perfil</dt><dd>{typeLabel[customer.customerType]}</dd></div>
                  <div><dt>Créditos</dt><dd className="platform-customer-credit-value">{customer.creditsAvailable}</dd></div>
                  <div><dt>Cadastro</dt><dd>{customer.createdAt.toLocaleDateString("pt-BR")}</dd></div>
                </dl>
                <div className="platform-customer-card-actions">
                  <Link href={`/gestao-interna/clientes/${customer.id}`}>Gerenciar cliente <span aria-hidden="true">→</span></Link>
                  <DeleteCustomerButton customerId={customer.id} customerName={customer.name ?? customer.email} />
                </div>
              </article>
            ))}
          </div>
        ) : <div className="platform-empty-state"><strong>Nenhum cliente encontrado</strong><span>Tente pesquisar outro nome ou e-mail.</span></div>}
      </section>

      {data.pagination.totalPages > 1 ? (
        <nav className="platform-pagination" aria-label="Paginação de clientes">
          {data.pagination.page > 1 ? <Link href={customerUrl(data.search, data.pagination.page - 1)}>← Anterior</Link> : <span />}
          <span>Página {data.pagination.page} de {data.pagination.totalPages}</span>
          {data.pagination.page < data.pagination.totalPages ? <Link href={customerUrl(data.search, data.pagination.page + 1)}>Próxima →</Link> : <span />}
        </nav>
      ) : null}
    </main>
  );
}
