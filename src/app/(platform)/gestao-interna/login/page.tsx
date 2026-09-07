import { redirect } from "next/navigation";
import { getCurrentPlatformSession } from "@/server/auth/admin-auth.service";

export const metadata = {
  title: "Acesso interno | SiteCasamento",
  robots: { index: false, follow: false },
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentPlatformSession()) redirect("/gestao-interna");
  const { error = "" } = await searchParams;

  return (
    <main className="platform-login-layout">
      <section className="platform-login-card" aria-labelledby="platform-login-title">
        <span className="platform-login-kicker">SITE CASAMENTO · INTERNO</span>
        <h1 id="platform-login-title">Acesso do administrador</h1>
        <p>Área reservada exclusivamente à operação da plataforma.</p>
        {error ? <div className="form-error-banner">{decodeURIComponent(error)}</div> : null}
        <form action="/api/platform/auth/login" method="post" className="login-form">
          <div className="login-field">
            <label htmlFor="platform-email">E-mail</label>
            <input id="platform-email" name="email" type="email" autoComplete="username" required />
          </div>
          <div className="login-field">
            <label htmlFor="platform-password">Senha</label>
            <input id="platform-password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <button type="submit" className="platform-login-button">Entrar na área interna</button>
        </form>
      </section>
    </main>
  );
}
