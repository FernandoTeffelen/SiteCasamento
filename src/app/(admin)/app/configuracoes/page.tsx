import { redirect } from "next/navigation";
import { requireAdminSession } from "@/server/auth/admin-auth.service";
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

  return (
    <AdminSettingsClient user={{ name: user.name ?? "", email: user.email }} />
  );
}
