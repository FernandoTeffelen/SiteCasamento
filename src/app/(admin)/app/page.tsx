import { redirect } from "next/navigation";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
import { prisma } from "@/server/db/prisma";
import { isDomainError } from "@/server/domain/error";

/** Base protegida do painel. Funcionalidades administrativas entram em rotas filhas. */
export default async function AdminAppPage() {
  let user: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    user = await requireAdminSession();
  } catch (error) {
    if (isDomainError(error)) redirect("/app/login");
    throw error;
  }

  const organizations = await prisma.organizationMembership.findMany({
    where: { userId: user.id },
    orderBy: { organization: { name: "asc" } },
    select: { role: true, organization: { select: { id: true, name: true } } },
  });

  return (
    <main className="admin-app-page">
      <header>
        <p>Painel da cerimonialista</p>
        <h1>Olá, {user.name ?? user.email}</h1>
        <form action="/api/admin/auth/logout" method="post"><button type="submit">Sair</button></form>
      </header>
      <section>
        <h2>Organizações autorizadas</h2>
        {organizations.length ? (
          <ul>{organizations.map(({ organization, role }) => <li key={organization.id}>{organization.name} · {role}</li>)}</ul>
        ) : <p>Esta conta ainda não está vinculada a uma organização.</p>}
      </section>
      <p>Casamentos, créditos, fotos e configurações serão disponibilizados em módulos protegidos neste ambiente.</p>
    </main>
  );
}
