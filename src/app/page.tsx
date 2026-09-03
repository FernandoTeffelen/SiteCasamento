import Link from "next/link";

export default function HomePage() {
  return (
    <main className="commercial-page">
      <section>
        <p>SiteCasamento</p>
        <h1>Experiências de casamento que cabem em um QR Code.</h1>
        <p>Planos, créditos avulsos e a gestão dos seus eventos ficam em um ambiente separado e seguro.</p>
        <Link href="/planos">Conhecer planos e créditos</Link>
        <Link href="/app/login">Entrar no painel</Link>
      </section>
    </main>
  );
}
