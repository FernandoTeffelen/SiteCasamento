import Link from "next/link";

export default function AdminLoginPage() {
  return (
    <main className="admin-auth-page">
      <form action="/api/admin/auth/login" method="post">
        <p>SiteCasamento</p>
        <h1>Entrar no painel</h1>
        <label htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
        <label htmlFor="password">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
        <button type="submit">Entrar</button>
        <Link href="/">Voltar ao site</Link>
      </form>
    </main>
  );
}
