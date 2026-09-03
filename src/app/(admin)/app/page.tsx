import { redirect } from "next/navigation";
import { requireAdminSession, checkUserIsPayingOrActive } from "@/server/auth/admin-auth.service";
import { getAdminDashboardData } from "@/server/admin/admin-weddings.service";
import { isDomainError } from "@/server/domain/error";
import { AdminDashboardClient } from "./admin-dashboard-client";

export const metadata = {
  title: "Painel da Cerimonialista | SiteCasamento",
  description: "Gerencie seus casamentos, convidados e fotos em tempo real.",
};

export default async function AdminAppPage() {
  let user: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    user = await requireAdminSession();
  } catch (error) {
    if (isDomainError(error)) redirect("/app/login");
    throw error;
  }

  // Se não é pagante, redirecionar para planos — não pode acessar o admin
  const isPaying = await checkUserIsPayingOrActive(user.id);
  if (!isPaying) {
    redirect("/planos?notice=subscription_required");
  }

  const dashboardData = await getAdminDashboardData(user.id);

  return (
    <AdminDashboardClient
      initialData={dashboardData}
      userName={user.name ?? user.email}
      userEmail={user.email}
    />
  );
}
