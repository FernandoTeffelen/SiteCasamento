import { redirect } from "next/navigation";
import { getAdminSubscriptionSummary, requireAdminSession } from "@/server/auth/admin-auth.service";
import { isDomainError } from "@/server/domain/error";
import { AdminSettingsClient } from "./admin-settings-client";

export const metadata = {
  title: "Configurações | SiteCasamento",
};

export default async function AdminSettingsPage() {
  let user: Awaited<ReturnType<typeof requireAdminSession>>;
  try {
    user = await requireAdminSession();
  } catch (error) {
    if (isDomainError(error)) redirect("/app/login");
    throw error;
  }

  const subscription = await getAdminSubscriptionSummary(user.id);

  return <AdminSettingsClient user={{ name: user.name ?? "", email: user.email }} subscription={subscription} />;
}
