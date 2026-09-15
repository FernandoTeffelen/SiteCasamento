export default function PlatformLoading() {
  return (
    <main className="route-loading-screen route-loading-platform" aria-busy="true" aria-live="polite">
      <span className="route-loading-mark" aria-hidden="true">SC</span>
      <h1>Carregando a gestão</h1>
      <p>Só um instante enquanto reunimos os dados da plataforma.</p>
    </main>
  );
}
