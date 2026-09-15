import Link from "next/link";

export default function WeddingNotFound() {
  return (
    <main className="route-loading-screen route-loading-wedding">
      <span className="route-loading-mark" aria-hidden="true">♥</span>
      <h1>Este link não está disponível</h1>
      <p>Confira o QR Code ou o link recebido. Se o casamento já terminou, peça orientação a quem organizou o evento.</p>
      <Link href="/" className="app-error-button">Ir para o SiteCasamento</Link>
    </main>
  );
}
